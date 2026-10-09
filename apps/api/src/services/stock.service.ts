import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { docConfig, hasStockEffect } from '../lib/doc-types.js';
import { lineAmount } from '../lib/totals.js';
import { parseISODate, toISODate, todayISO } from '../lib/dates.js';
import { cacheDel, CacheKeys } from '../lib/cache.js';

type Tx = Prisma.TransactionClient;

interface StockDoc {
  id: string;
  orgId: string | null;
  docType: string;
  status: string;
  approvalStatus: string | null;
  affectsStock: boolean;
  clientId: string | null;
  issueDate: Date;
}

interface StockLine {
  itemId: string | null;
  description: string;
  quantity: Prisma.Decimal | number;
  unitPrice: Prisma.Decimal | number;
  discountPercent: Prisma.Decimal | number | null;
  damagedQty: Prisma.Decimal | number;
  bindingCharge?: Prisma.Decimal | number;
}

export interface MovementInput {
  itemId: string;
  docId?: string | null;
  docType: string;
  date: Date;
  qtyChange: number;
  damagedChange: number;
  rate: number;
  reason?: string | null;
}

export type StockFilter = 'all' | 'low' | 'out' | 'attention' | 'damaged' | 'in_stock';

/** How one document line changes saleable and damaged stock. */
export function lineStockEffect(docType: string, quantity: number, damaged: number) {
  const qty = Math.round(quantity);
  const dmg = Math.min(Math.round(damaged), qty);
  switch (docConfig(docType).stock) {
    case 'out':
      // Purchase returns send damaged copies back from damaged stock.
      return docType === 'purchase_return'
        ? { qtyChange: -(qty - dmg), damagedChange: -dmg }
        : { qtyChange: -qty, damagedChange: 0 };
    case 'in':
      // Damaged copies received (print defects, transit damage) are kept aside.
      return { qtyChange: qty - dmg, damagedChange: dmg };
    default:
      return { qtyChange: 0, damagedChange: 0 };
  }
}

export class StockService {
  async applyMovement(tx: Tx, orgId: string, userId: string | null, m: MovementInput) {
    if (m.qtyChange === 0 && m.damagedChange === 0) return;
    await tx.stockMovement.create({
      data: {
        orgId,
        itemId: m.itemId,
        docId: m.docId ?? null,
        docType: m.docType,
        movementDate: m.date,
        qtyChange: m.qtyChange,
        damagedChange: m.damagedChange,
        rate: m.rate,
        reason: m.reason ?? null,
        userId,
      },
    });
    await tx.$executeRaw`
      UPDATE inventory_items
      SET stock = COALESCE(stock, 0) + ${m.qtyChange},
          damaged_stock = damaged_stock + ${m.damagedChange}
      WHERE id = ${m.itemId}::uuid AND org_id = ${orgId}::uuid
    `;
  }

  /** Undo every movement a document made (used before re-posting, cancelling or deleting). */
  async reverseDocument(tx: Tx, docId: string) {
    const movements = await tx.stockMovement.findMany({ where: { docId } });
    for (const m of movements) {
      await tx.$executeRaw`
        UPDATE inventory_items
        SET stock = COALESCE(stock, 0) - ${m.qtyChange},
            damaged_stock = damaged_stock - ${m.damagedChange}
        WHERE id = ${m.itemId}::uuid
      `;
    }
    if (movements.length > 0) await tx.stockMovement.deleteMany({ where: { docId } });
  }

  /** Brings stock in line with the document's current lines and state. */
  async syncDocument(tx: Tx, doc: StockDoc, lines: StockLine[], userId: string | null) {
    await this.reverseDocument(tx, doc.id);
    if (!doc.orgId || !hasStockEffect(doc)) return;

    for (const line of lines) {
      if (!line.itemId) continue;
      const { qtyChange, damagedChange } = lineStockEffect(doc.docType, Number(line.quantity), Number(line.damagedQty));
      const qty = Number(line.quantity) || 0;
      const rate = qty > 0
        ? lineAmount({ quantity: qty, unit_price: Number(line.unitPrice), discount_percent: Number(line.discountPercent ?? 0), binding_charge: Number(line.bindingCharge ?? 0) }) / qty
        : 0;
      await this.applyMovement(tx, doc.orgId, userId, {
        itemId: line.itemId,
        docId: doc.id,
        docType: doc.docType,
        date: doc.issueDate,
        qtyChange,
        damagedChange,
        rate: Math.round(rate * 100) / 100,
        reason: line.description,
      });
    }
  }

  /**
   * The latest purchase bill sets an item's purchase rate (net of line discount),
   * so the binder's / supplier's rate is always current for margins and stock value.
   */
  async updatePurchaseRates(tx: Tx, orgId: string, doc: StockDoc, lines: StockLine[]) {
    if (doc.docType !== 'purchase_bill' || doc.status === 'cancelled') return;
    for (const line of lines) {
      if (!line.itemId || Number(line.quantity) <= 0) continue;
      const newer = await tx.invoiceItem.count({
        where: {
          itemId: line.itemId,
          invoice: { orgId, docType: 'purchase_bill', status: { not: 'cancelled' }, issueDate: { gt: doc.issueDate }, id: { not: doc.id } },
        },
      });
      if (newer > 0) continue;
      // Book rate and binding charge are kept apart; landed cost = both, net of discount.
      const disc = 1 - Math.min(Math.max(Number(line.discountPercent ?? 0), 0), 100) / 100;
      await tx.inventoryItem.updateMany({
        where: { id: line.itemId, orgId },
        data: {
          purchaseRate: Math.round(Number(line.unitPrice) * disc * 100) / 100,
          bindingCharge: Math.round(Number(line.bindingCharge ?? 0) * disc * 100) / 100,
        },
      });
    }
  }

  async recordOpening(tx: Tx, orgId: string, userId: string | null, itemId: string, qty: number, rate: number) {
    await this.applyMovement(tx, orgId, userId, {
      itemId, docType: 'opening', date: parseISODate(todayISO()), qtyChange: Math.round(qty), damagedChange: 0, rate, reason: 'Opening stock',
    });
  }

  async adjust(
    orgId: string,
    userId: string,
    itemId: string,
    input: { qty_change: number; damaged_change: number; reason: string; date?: string }
  ) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, orgId } });
    if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

    await prisma.$transaction(async (tx) => {
      await this.applyMovement(tx, orgId, userId, {
        itemId,
        docType: 'adjustment',
        date: parseISODate(input.date || todayISO()),
        qtyChange: Math.round(input.qty_change),
        damagedChange: Math.round(input.damaged_change),
        rate: Number(item.purchaseRate) || Number(item.price) || 0,
        reason: input.reason,
      });
    });
    await this.invalidate(orgId);
    return this.getItemStock(orgId, itemId);
  }

  async getItemStock(orgId: string, itemId: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, orgId } });
    if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
    return serializeStockRow({
      id: item.id,
      book_title: item.bookTitle,
      isbn: item.isbn,
      author: item.author,
      publisher: item.publisher,
      binding: item.binding,
      price: item.price,
      purchase_rate: item.purchaseRate,
      binding_charge: item.bindingCharge,
      stock: item.stock,
      damaged_stock: item.damagedStock,
      min_stock: item.minStock,
    });
  }

  async listMovements(orgId: string, q: { item_id?: string; from?: string; to?: string; page: number; limit: number }) {
    const where: Prisma.StockMovementWhereInput = {
      orgId,
      ...(q.item_id && { itemId: q.item_id }),
      ...((q.from || q.to) && {
        movementDate: {
          ...(q.from && { gte: parseISODate(q.from) }),
          ...(q.to && { lte: parseISODate(q.to) }),
        },
      }),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          item: { select: { bookTitle: true, isbn: true } },
          doc: { select: { invoiceNumber: true, docType: true, partyName: true, client: { select: { name: true } } } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      movements: rows.map((m) => ({
        id: m.id,
        item_id: m.itemId,
        book_title: m.item.bookTitle,
        isbn: m.item.isbn,
        doc_id: m.docId,
        doc_type: m.docType,
        doc_number: m.doc?.invoiceNumber ?? null,
        party_name: m.doc?.client?.name ?? m.doc?.partyName ?? null,
        date: toISODate(m.movementDate),
        qty_change: m.qtyChange,
        damaged_change: m.damagedChange,
        rate: Number(m.rate),
        reason: m.reason,
        created_at: m.createdAt,
      })),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  async summary(orgId: string, q: { search?: string; binding?: string; filter: StockFilter; page: number; limit: number }) {
    const conditions: Prisma.Sql[] = [Prisma.sql`org_id = ${orgId}::uuid`];
    if (q.search) {
      const like = `%${q.search}%`;
      conditions.push(Prisma.sql`("Book Title" ILIKE ${like} OR "ISBN" ILIKE ${like} OR "Name of Author/Editor" ILIKE ${like})`);
    }
    if (q.binding) conditions.push(Prisma.sql`binding = ${q.binding}`);
    const base = Prisma.join(conditions, ' AND ');

    const filterSql =
      q.filter === 'low' ? Prisma.sql` AND min_stock > 0 AND COALESCE(stock, 0) <= min_stock AND COALESCE(stock, 0) > 0`
      : q.filter === 'out' ? Prisma.sql` AND COALESCE(stock, 0) <= 0`
      : q.filter === 'attention' ? Prisma.sql` AND ((min_stock > 0 AND COALESCE(stock, 0) <= min_stock) OR COALESCE(stock, 0) <= 0)`
      : q.filter === 'damaged' ? Prisma.sql` AND damaged_stock > 0`
      : q.filter === 'in_stock' ? Prisma.sql` AND COALESCE(stock, 0) > 0`
      : Prisma.empty;
    const orderSql = q.filter === 'attention'
      ? Prisma.sql`COALESCE(stock, 0) - min_stock ASC, "Book Title" ASC`
      : Prisma.sql`"Book Title" ASC`;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, "Book Title" AS book_title, "ISBN" AS isbn, "Name of Author/Editor" AS author,
             "Name of Publishing Agency/Publisher" AS publisher, binding, price, purchase_rate,
             binding_charge, stock, damaged_stock, min_stock
      FROM inventory_items
      WHERE ${base} ${filterSql}
      ORDER BY ${orderSql}
      LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}
    `;

    const [agg] = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int                                                            AS item_count,
        COALESCE(SUM(GREATEST(COALESCE(stock, 0), 0)), 0)::int                   AS total_qty,
        COALESCE(SUM(damaged_stock), 0)::int                                     AS total_damaged,
        COALESCE(SUM(GREATEST(COALESCE(stock, 0), 0) * (purchase_rate + binding_charge)), 0)::float AS value_at_cost,
        COALESCE(SUM(GREATEST(COALESCE(stock, 0), 0) * COALESCE(price, 0)), 0)::float AS value_at_price,
        COUNT(*) FILTER (WHERE min_stock > 0 AND COALESCE(stock, 0) <= min_stock AND COALESCE(stock, 0) > 0)::int AS low_count,
        COUNT(*) FILTER (WHERE COALESCE(stock, 0) <= 0)::int                     AS out_count,
        COUNT(*) FILTER (WHERE damaged_stock > 0)::int                           AS damaged_count
      FROM inventory_items
      WHERE ${base}
    `;

    const [{ filtered }] = await prisma.$queryRaw<{ filtered: number }[]>`
      SELECT COUNT(*)::int AS filtered FROM inventory_items WHERE ${base} ${filterSql}
    `;

    const bindings = await prisma.$queryRaw<{ binding: string }[]>`
      SELECT DISTINCT binding FROM inventory_items
      WHERE org_id = ${orgId}::uuid AND binding IS NOT NULL AND binding <> ''
      ORDER BY binding
    `;

    return {
      items: rows.map(serializeStockRow),
      totals: agg,
      bindings: bindings.map((b) => b.binding),
      total: filtered,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(filtered / q.limit)),
    };
  }

  async invalidate(orgId: string) {
    await cacheDel(CacheKeys.inventory(orgId), CacheKeys.dashboardStats(orgId), CacheKeys.dashboardOverview(orgId));
  }
}

function serializeStockRow(r: any) {
  const stock = Number(r.stock ?? 0);
  const minStock = Number(r.min_stock ?? 0);
  const purchaseRate = Number(r.purchase_rate ?? 0);
  const bindingCharge = Number(r.binding_charge ?? 0);
  const price = Number(r.price ?? 0);
  return {
    id: r.id,
    book_title: r.book_title,
    isbn: r.isbn,
    author: r.author,
    publisher: r.publisher,
    binding: r.binding,
    price,
    purchase_rate: purchaseRate,
    binding_charge: bindingCharge,
    landed_cost: purchaseRate + bindingCharge,
    stock,
    damaged_stock: Number(r.damaged_stock ?? 0),
    min_stock: minStock,
    stock_value: Math.max(stock, 0) * (purchaseRate + bindingCharge),
    status: stock <= 0 ? 'out' : minStock > 0 && stock <= minStock ? 'low' : 'ok',
  };
}

export const stockService = new StockService();
