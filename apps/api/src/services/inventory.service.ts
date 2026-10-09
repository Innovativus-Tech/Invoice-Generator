import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../lib/cache.js';
import { stockService } from './stock.service.js';
import { parseISODate, todayISO } from '../lib/dates.js';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

function mapItem(item: any) {
  return {
    id: item.id,
    user_id: item.userId,
    org_id: item.orgId,
    book_title: item.bookTitle,
    isbn: item.isbn,
    author: item.author,
    publisher: item.publisher,
    product_form: item.productForm,
    language: item.language,
    applicant_type: item.applicantType,
    imprint: item.imprint,
    publication_date: item.publicationDate,
    price: item.price !== null ? Number(item.price) : 0,
    gst_rate: item.gstRate !== null ? Number(item.gstRate) : 0,
    stock: item.stock ?? 0,
    binding: item.binding ?? null,
    purchase_rate: item.purchaseRate != null ? Number(item.purchaseRate) : 0,
    binding_charge: item.bindingCharge != null ? Number(item.bindingCharge) : 0,
    min_stock: item.minStock ?? 0,
    damaged_stock: item.damagedStock ?? 0,
    hsn_code: item.hsnCode ?? null,
    created_at: item.createdAt,
  };
}

function csvNumber(value: unknown): number {
  const n = parseFloat(String(value ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Columns editable from the inventory form (stock is changed through stock movements). */
function itemFields(itemData: any) {
  return {
    bookTitle: itemData.book_title,
    isbn: itemData.isbn || null,
    productForm: itemData.product_form || null,
    language: itemData.language || null,
    applicantType: itemData.applicant_type || null,
    publisher: itemData.publisher || null,
    imprint: itemData.imprint || null,
    author: itemData.author || null,
    publicationDate: itemData.publication_date || null,
    price: Number(itemData.price) || 0,
    gstRate: itemData.gst_rate ?? 0,
    binding: itemData.binding || null,
    purchaseRate: Math.max(Number(itemData.purchase_rate) || 0, 0),
    bindingCharge: Math.max(Number(itemData.binding_charge) || 0, 0),
    minStock: Math.max(Math.round(Number(itemData.min_stock) || 0), 0),
    hsnCode: itemData.hsn_code || null,
  };
}

export class InventoryService {
  async getInventory(orgId: string) {
    const key = CacheKeys.inventory(orgId);
    const cached = await cacheGet<ReturnType<typeof mapItem>[]>(key);
    if (cached) return cached;

    const items = await prisma.inventoryItem.findMany({
      where: { orgId },
      orderBy: { bookTitle: 'asc' },
      select: {
        id: true,
        userId: true,
        orgId: true,
        bookTitle: true,
        isbn: true,
        author: true,
        publisher: true,
        productForm: true,
        language: true,
        applicantType: true,
        imprint: true,
        publicationDate: true,
        price: true,
        gstRate: true,
        stock: true,
        binding: true,
        purchaseRate: true,
        bindingCharge: true,
        minStock: true,
        damagedStock: true,
        hsnCode: true,
        createdAt: true,
      },
    });
    const result = items.map(mapItem);
    await cacheSet(key, result, 300);
    return result;
  }

  async searchInventory(orgId: string, q: string, limit = 10) {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];

    // Full-text search via raw SQL (tsvector column is not writable by Prisma)
    const tsQuery = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word + ':*')
      .join(' & ');

    const ftsResults = await prisma.$queryRaw<any[]>`
      SELECT id, user_id, org_id, "Book Title" as "bookTitle", "ISBN" as isbn,
             "Name of Author/Editor" as author,
             "Name of Publishing Agency/Publisher" as publisher,
             "Product Form" as "productForm", "Language" as language,
             "Applicant Type" as "applicantType", "Imprint" as imprint,
             "Publication Date" as "publicationDate",
             price, gst_rate as "gstRate", stock, binding, purchase_rate as "purchaseRate",
             binding_charge as "bindingCharge", min_stock as "minStock", damaged_stock as "damagedStock", hsn_code as "hsnCode",
             created_at as "createdAt"
      FROM inventory_items
      WHERE org_id = ${orgId}::uuid
        AND search_vector @@ to_tsquery('simple', ${tsQuery})
      LIMIT ${limit}
    `;

    const isbnResults = await prisma.$queryRaw<any[]>`
      SELECT id, user_id, org_id, "Book Title" as "bookTitle", "ISBN" as isbn,
             "Name of Author/Editor" as author,
             "Name of Publishing Agency/Publisher" as publisher,
             "Product Form" as "productForm", "Language" as language,
             "Applicant Type" as "applicantType", "Imprint" as imprint,
             "Publication Date" as "publicationDate",
             price, gst_rate as "gstRate", stock, binding, purchase_rate as "purchaseRate",
             binding_charge as "bindingCharge", min_stock as "minStock", damaged_stock as "damagedStock", hsn_code as "hsnCode",
             created_at as "createdAt"
      FROM inventory_items
      WHERE org_id = ${orgId}::uuid
        AND "ISBN" ILIKE ${trimmed + '%'}
      LIMIT 5
    `;

    const seen = new Set<string>();
    const merged = [...(ftsResults || []), ...(isbnResults || [])]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, limit);

    return merged.map((row) => mapItem({ ...row, userId: row.user_id, orgId: row.org_id }));
  }

  async createItem(orgId: string, userId: string, itemData: any) {
    const openingStock = Math.round(Number(itemData.stock) || 0);
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: { userId, orgId, ...itemFields(itemData), stock: 0, damagedStock: 0 },
      });
      if (openingStock !== 0) {
        await stockService.recordOpening(tx, orgId, userId, created.id, openingStock, Number(created.purchaseRate) || Number(created.price) || 0);
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: created.id } });
    });
    await stockService.invalidate(orgId);
    return mapItem(item);
  }

  async updateItem(orgId: string, id: string, itemData: any, userId: string | null = null) {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({ where: { id, orgId } });
      if (!existing) throw Object.assign(new Error('Item not found'), { status: 404 });
      await tx.inventoryItem.update({ where: { id }, data: itemFields({ ...mapItem(existing), ...itemData }) });

      // Editing the stock figure records the difference as an adjustment so the
      // stock history still adds up.
      if (itemData.stock !== undefined && itemData.stock !== null && itemData.stock !== '') {
        const delta = Math.round(Number(itemData.stock)) - (existing.stock ?? 0);
        if (delta !== 0) {
          await stockService.applyMovement(tx, orgId, userId, {
            itemId: id,
            docType: 'adjustment',
            date: parseISODate(todayISO()),
            qtyChange: delta,
            damagedChange: 0,
            rate: Number(existing.purchaseRate) || Number(existing.price) || 0,
            reason: 'Stock corrected from inventory form',
          });
        }
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id } });
    });
    await stockService.invalidate(orgId);
    return mapItem(item);
  }

  async deleteItem(orgId: string, id: string) {
    await cacheDel(CacheKeys.inventory(orgId));
    await prisma.inventoryItem.deleteMany({ where: { id, orgId } });
    return true;
  }

  async processCSV(orgId: string, userId: string, csvBuffer: Buffer): Promise<{ inserted: number; skipped: number }> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let skipped = 0;

      Readable.from(csvBuffer)
        .pipe(csvParser())
        .on('data', (row) => {
          const bookTitle = row['Book Title'];
          if (!bookTitle || bookTitle.trim() === '') {
            skipped++;
            return;
          }
          results.push({
            userId,
            orgId,
            bookTitle: row['Book Title'],
            isbn: row['ISBN'] || null,
            productForm: row['Product Form'] || null,
            language: row['Language'] || null,
            applicantType: row['Applicant Type'] || null,
            publisher: row['Name of Publishing Agency/Publisher'] || null,
            imprint: row['Imprint'] || null,
            author: row['Name of Author/Editor'] || null,
            publicationDate: row['Publication Date'] || null,
            // Optional columns — catalogue exports usually leave these out.
            price: csvNumber(row['Price'] ?? row['MRP']),
            gstRate: csvNumber(row['GST Rate'] ?? row['GST']),
            purchaseRate: csvNumber(row['Purchase Rate']),
            binding: (row['Binding'] || '').trim() || null,
            hsnCode: (row['HSN'] || '').trim() || null,
            stock: Math.round(csvNumber(row['Stock'] ?? row['Quantity'])),
          });
        })
        .on('end', async () => {
          try {
            const BATCH_SIZE = 500;
            let inserted = 0;
            for (let i = 0; i < results.length; i += BATCH_SIZE) {
              const batch = results.slice(i, i + BATCH_SIZE);
              await prisma.$transaction(async (tx) => {
                const created = await tx.inventoryItem.createManyAndReturn({
                  data: batch.map((row) => ({ ...row, stock: 0 })),
                  select: { id: true },
                });
                // Record the imported quantity as opening stock (keeps stock = sum of movements).
                const openings = created
                  .map((c, idx) => ({ id: c.id, qty: batch[idx].stock as number }))
                  .filter((o) => o.qty !== 0);
                if (openings.length > 0) {
                  await tx.stockMovement.createMany({
                    data: openings.map((o) => ({
                      orgId, itemId: o.id, docType: 'opening', qtyChange: o.qty, reason: 'Opening stock (CSV import)', userId,
                    })),
                  });
                  for (const o of openings) {
                    await tx.inventoryItem.update({ where: { id: o.id }, data: { stock: o.qty } });
                  }
                }
              }, { timeout: 60_000 });
              inserted += batch.length;
            }
            await cacheDel(CacheKeys.inventory(orgId));
            resolve({ inserted, skipped });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}

export const inventoryService = new InventoryService();
