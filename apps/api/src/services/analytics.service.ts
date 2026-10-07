import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, CacheKeys } from '../lib/cache.js';
import { DOC_TYPE_CONFIG, isPosted } from '../lib/doc-types.js';
import { round2 } from '../lib/totals.js';
import { addDays, diffDays, parseISODate, toISODate, todayISO } from '../lib/dates.js';
import { ledgerService } from './ledger.service.js';
import { stockService } from './stock.service.js';

export type ReportPeriod = 'month' | 'year' | 'fy';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function periodRange(period: ReportPeriod, year: number, month: number) {
  if (period === 'month') {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = addDays(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`, -1);
    return { from, to, label: `${MONTHS[month - 1]} ${year}` };
  }
  if (period === 'fy') {
    return { from: `${year}-04-01`, to: `${year + 1}-03-31`, label: `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}` };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
}

/** Buckets for the breakdown chart: days of the month, or months of the (financial) year. */
function buckets(period: ReportPeriod, from: string, to: string) {
  const out: { key: string; label: string }[] = [];
  if (period === 'month') {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ key: d, label: String(Number(d.slice(8, 10))) });
  } else {
    let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
    for (let i = 0; i < 12; i++) {
      out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${String(y).slice(2)}` });
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  return out;
}

type Row = {
  sales: number;
  purchases: number;
  sales_returns: number;
  purchase_returns: number;
  collections: number;
  payments_out: number;
};

const emptyRow = (): Row => ({ sales: 0, purchases: 0, sales_returns: 0, purchase_returns: 0, collections: 0, payments_out: 0 });

export class AnalyticsService {
  async report(orgId: string, period: ReportPeriod, year: number, month: number) {
    const { from, to, label } = periodRange(period, year, month);
    const range = { gte: parseISODate(from), lte: parseISODate(to) };

    const [docs, payments, quickPurchases] = await Promise.all([
      prisma.invoice.findMany({
        where: { orgId, issueDate: range, status: { not: 'cancelled' } },
        select: {
          id: true, docType: true, invoiceNumber: true, status: true, approvalStatus: true, affectsStock: true,
          clientId: true, partyName: true, paymentMode: true, issueDate: true, subtotal: true, discountAmount: true,
          taxAmount: true, postageCharge: true, otherCharges: true, total: true, amountPaid: true,
          client: { select: { name: true } },
          invoiceItems: {
            select: {
              description: true, quantity: true, amount: true, damagedQty: true, binding: true, itemId: true,
              inventoryItem: { select: { purchaseRate: true, binding: true } },
            },
          },
        },
        orderBy: { issueDate: 'asc' },
      }),
      prisma.payment.findMany({ where: { orgId, paymentDate: range }, select: { direction: true, amount: true, paymentDate: true } }),
      prisma.purchaseOrder.aggregate({
        where: { orgId, purchaseDate: range, status: { not: 'cancelled' } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    const posted = docs.filter((d) => isPosted(d));
    const bucketList = buckets(period, from, to);
    const breakdown = new Map(bucketList.map((b) => [b.key, emptyRow()]));
    const bucketKey = (d: Date) => (period === 'month' ? toISODate(d)! : toISODate(d)!.slice(0, 7));

    const sales = { gross: 0, count: 0, cash: 0, credit: 0, taxable: 0, tax: 0, discount: 0, postage: 0, other_charges: 0, returns: 0, returns_count: 0, credit_notes: 0, net: 0, qty: 0 };
    const purchases = { gross: 0, count: 0, cash: 0, credit: 0, tax: 0, returns: 0, returns_count: 0, debit_notes: 0, net: 0, qty: 0, damaged_qty: 0, quick_purchases: 0, quick_purchase_count: 0 };
    const estimates = { count: 0, total: 0, converted: 0 };
    const challans = { count: 0, total: 0, converted: 0 };
    let marginRevenue = 0;
    let marginCost = 0;
    let marginLines = 0;
    let unlinkedLines = 0;

    const customers = new Map<string, { name: string; sales: number; returns: number; count: number }>();
    const suppliers = new Map<string, { name: string; purchases: number; returns: number; count: number }>();
    const items = new Map<string, { description: string; qty: number; amount: number }>();
    const bindings = new Map<string, { binding: string; qty: number; amount: number }>();

    for (const d of posted) {
      const total = Number(d.total);
      const row = breakdown.get(bucketKey(d.issueDate));
      const partyKey = d.clientId ?? `walkin:${d.partyName ?? ''}`;
      const partyName = d.client?.name ?? d.partyName ?? 'Walk-in';
      // Line amounts are before the bill-level extra discount; scale them down to net value.
      const subtotal = Number(d.subtotal);
      const factor = subtotal > 0 ? (subtotal - Number(d.discountAmount)) / subtotal : 0;

      switch (d.docType) {
        case 'sales_invoice': {
          sales.gross += total;
          sales.count++;
          if (d.paymentMode === 'cash') sales.cash += total; else sales.credit += total;
          sales.taxable += subtotal - Number(d.discountAmount);
          sales.tax += Number(d.taxAmount);
          sales.discount += Number(d.discountAmount);
          sales.postage += Number(d.postageCharge);
          sales.other_charges += Number(d.otherCharges);
          if (row) row.sales += total;
          const c = customers.get(partyKey) ?? { name: partyName, sales: 0, returns: 0, count: 0 };
          c.sales += total; c.count++;
          customers.set(partyKey, c);
          for (const line of d.invoiceItems) {
            const qty = Number(line.quantity);
            const net = Number(line.amount) * factor;
            sales.qty += qty;
            const key = line.itemId ?? line.description.toLowerCase();
            const it = items.get(key) ?? { description: line.description, qty: 0, amount: 0 };
            it.qty += qty; it.amount += net;
            items.set(key, it);
            const bind = line.binding || line.inventoryItem?.binding || 'Unspecified';
            const b = bindings.get(bind) ?? { binding: bind, qty: 0, amount: 0 };
            b.qty += qty; b.amount += net;
            bindings.set(bind, b);
            const rate = Number(line.inventoryItem?.purchaseRate ?? 0);
            if (line.itemId && rate > 0) {
              marginRevenue += net;
              marginCost += qty * rate;
              marginLines++;
            } else {
              unlinkedLines++;
            }
          }
          break;
        }
        case 'sales_return': {
          sales.returns += total;
          sales.returns_count++;
          if (row) row.sales_returns += total;
          const c = customers.get(partyKey) ?? { name: partyName, sales: 0, returns: 0, count: 0 };
          c.returns += total;
          customers.set(partyKey, c);
          for (const line of d.invoiceItems) {
            const rate = Number(line.inventoryItem?.purchaseRate ?? 0);
            if (line.itemId && rate > 0) {
              marginRevenue -= Number(line.amount) * factor;
              marginCost -= Number(line.quantity) * rate;
            }
          }
          break;
        }
        case 'credit_note':
          sales.credit_notes += total;
          if (row) row.sales_returns += total;
          break;
        case 'purchase_bill': {
          purchases.gross += total;
          purchases.count++;
          if (d.paymentMode === 'cash') purchases.cash += total; else purchases.credit += total;
          purchases.tax += Number(d.taxAmount);
          for (const line of d.invoiceItems) {
            purchases.qty += Number(line.quantity);
            purchases.damaged_qty += Number(line.damagedQty);
          }
          if (row) row.purchases += total;
          const s = suppliers.get(partyKey) ?? { name: partyName, purchases: 0, returns: 0, count: 0 };
          s.purchases += total; s.count++;
          suppliers.set(partyKey, s);
          break;
        }
        case 'purchase_return': {
          purchases.returns += total;
          purchases.returns_count++;
          if (row) row.purchase_returns += total;
          const s = suppliers.get(partyKey) ?? { name: partyName, purchases: 0, returns: 0, count: 0 };
          s.returns += total;
          suppliers.set(partyKey, s);
          break;
        }
        case 'debit_note':
          purchases.debit_notes += total;
          if (row) row.purchase_returns += total;
          break;
        case 'estimate':
          estimates.count++;
          estimates.total += total;
          if (d.status === 'converted') estimates.converted++;
          break;
        case 'delivery_challan':
          challans.count++;
          challans.total += total;
          if (d.status === 'converted') challans.converted++;
          break;
      }
    }

    let collections = 0;
    let paymentsOut = 0;
    for (const p of payments) {
      const amount = Number(p.amount);
      const row = breakdown.get(bucketKey(p.paymentDate));
      if (p.direction === 'in') { collections += amount; if (row) row.collections += amount; }
      else { paymentsOut += amount; if (row) row.payments_out += amount; }
    }
    // Cash bills are collected on the spot.
    for (const d of posted) {
      if (d.paymentMode !== 'cash' || !DOC_TYPE_CONFIG[d.docType as keyof typeof DOC_TYPE_CONFIG]?.isBill) continue;
      const row = breakdown.get(bucketKey(d.issueDate));
      if (d.docType === 'sales_invoice') { collections += Number(d.total); if (row) row.collections += Number(d.total); }
      else { paymentsOut += Number(d.total); if (row) row.payments_out += Number(d.total); }
    }

    sales.net = sales.gross - sales.returns - sales.credit_notes;
    purchases.quick_purchases = Number(quickPurchases._sum.totalAmount ?? 0);
    purchases.quick_purchase_count = quickPurchases._count;
    purchases.net = purchases.gross - purchases.returns - purchases.debit_notes;

    const r = <T extends Record<string, number>>(o: T) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round2(v)])) as T;

    return {
      period,
      label,
      from,
      to,
      sales: r(sales),
      purchases: r(purchases),
      estimates: r(estimates),
      challans: r(challans),
      collections: round2(collections),
      payments_out: round2(paymentsOut),
      margin: {
        revenue: round2(marginRevenue),
        cost: round2(marginCost),
        gross_margin: round2(marginRevenue - marginCost),
        margin_percent: marginRevenue > 0 ? round2(((marginRevenue - marginCost) / marginRevenue) * 100) : 0,
        lines_with_cost: marginLines,
        lines_without_cost: unlinkedLines,
      },
      breakdown: bucketList.map((b) => {
        const row = breakdown.get(b.key)!;
        return { key: b.key, label: b.label, ...r(row), net_sales: round2(row.sales - row.sales_returns) };
      }),
      top_customers: [...customers.values()]
        .map((c) => ({ ...c, sales: round2(c.sales), returns: round2(c.returns), net: round2(c.sales - c.returns) }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 10),
      top_suppliers: [...suppliers.values()]
        .map((s) => ({ ...s, purchases: round2(s.purchases), returns: round2(s.returns), net: round2(s.purchases - s.returns) }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 10),
      top_items: [...items.values()]
        .map((i) => ({ ...i, amount: round2(i.amount) }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
      binding_wise: [...bindings.values()]
        .map((b) => ({ ...b, amount: round2(b.amount) }))
        .sort((a, b) => b.amount - a.amount),
      documents: posted
        .filter((d) => ['sales_invoice', 'sales_return', 'credit_note', 'purchase_bill', 'purchase_return', 'debit_note'].includes(d.docType))
        .map((d) => ({
          id: d.id,
          doc_type: d.docType,
          invoice_number: d.invoiceNumber,
          issue_date: toISODate(d.issueDate),
          party_name: d.client?.name ?? d.partyName ?? 'Walk-in',
          payment_mode: d.paymentMode,
          status: d.status,
          total: Number(d.total),
        })),
    };
  }

  async overview(orgId: string) {
    const key = CacheKeys.dashboardOverview(orgId);
    const cached = await cacheGet<object>(key);
    if (cached) return cached;

    const today = todayISO();
    const monthStart = `${today.slice(0, 7)}-01`;
    const lastMonthStart = addDays(monthStart, -1).slice(0, 7) + '-01';
    const lastMonthSameDay = (() => {
      const candidate = `${lastMonthStart.slice(0, 7)}-${today.slice(8, 10)}`;
      const lastDay = addDays(monthStart, -1);
      return candidate > lastDay || Number.isNaN(parseISODate(candidate).getTime()) ? lastDay : candidate;
    })();
    const chartStart = (() => {
      let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
      m -= 11;
      while (m <= 0) { m += 12; y--; }
      return `${y}-${String(m).padStart(2, '0')}-01`;
    })();

    const sumWhere = (docType: string, from: string, to: string, extra: Prisma.InvoiceWhereInput = {}) =>
      prisma.invoice.aggregate({
        where: { orgId, docType, status: { not: 'cancelled' }, issueDate: { gte: parseISODate(from), lte: parseISODate(to) }, ...extra },
        _sum: { total: true },
        _count: true,
      });

    const [
      todaySales, monthSales, lastMonthSales, monthPurchases, monthReturns,
      monthCollections, monthCashSales, todayCollections, todayCashSales,
      receivables, payables, stock, pending, recent, inTransit, open, chartDocs, dueSoon,
    ] = await Promise.all([
      sumWhere('sales_invoice', today, today),
      sumWhere('sales_invoice', monthStart, today),
      sumWhere('sales_invoice', lastMonthStart, lastMonthSameDay),
      sumWhere('purchase_bill', monthStart, today),
      sumWhere('sales_return', monthStart, today, { approvalStatus: 'approved' }),
      prisma.payment.aggregate({ where: { orgId, direction: 'in', paymentDate: { gte: parseISODate(monthStart), lte: parseISODate(today) } }, _sum: { amount: true } }),
      sumWhere('sales_invoice', monthStart, today, { paymentMode: 'cash' }),
      prisma.payment.aggregate({ where: { orgId, direction: 'in', paymentDate: parseISODate(today) }, _sum: { amount: true } }),
      sumWhere('sales_invoice', today, today, { paymentMode: 'cash' }),
      ledgerService.getOutstanding(orgId, 'receivable'),
      ledgerService.getOutstanding(orgId, 'payable'),
      stockService.summary(orgId, { filter: 'attention', page: 1, limit: 8 }),
      prisma.invoice.findMany({
        where: { orgId, approvalStatus: 'pending', status: { not: 'cancelled' } },
        select: { id: true, docType: true, invoiceNumber: true, partyName: true, total: true, issueDate: true, client: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 6,
      }),
      prisma.invoice.findMany({
        where: { orgId },
        select: { id: true, docType: true, invoiceNumber: true, status: true, approvalStatus: true, partyName: true, total: true, issueDate: true, paymentMode: true, client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.invoice.findMany({
        where: { orgId, status: { not: 'cancelled' }, deliveryStatus: { in: ['dispatched', 'in_transit'] } },
        select: {
          id: true, docType: true, invoiceNumber: true, partyName: true, dispatchMode: true, courierName: true, trackingNumber: true,
          transportName: true, lrNumber: true, dispatchDate: true, expectedDeliveryDate: true, deliveryStatus: true, client: { select: { name: true } },
        },
        orderBy: { dispatchDate: 'asc' },
        take: 6,
      }),
      prisma.invoice.groupBy({
        by: ['docType'],
        where: { orgId, docType: { in: ['estimate', 'delivery_challan', 'binding_order'] }, status: { in: ['draft', 'sent', 'viewed'] } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.findMany({
        where: { orgId, docType: { in: ['sales_invoice', 'purchase_bill', 'sales_return', 'purchase_return'] }, status: { not: 'cancelled' }, issueDate: { gte: parseISODate(chartStart) } },
        select: { docType: true, total: true, issueDate: true, approvalStatus: true },
      }),
      prisma.invoice.findMany({
        where: {
          orgId, docType: 'sales_invoice', paymentMode: 'credit', status: { notIn: ['paid', 'cancelled'] },
          dueDate: { gte: parseISODate(today), lte: parseISODate(addDays(today, 7)) },
        },
        select: { id: true, invoiceNumber: true, dueDate: true, total: true, amountPaid: true, partyName: true, client: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
    ]);

    const months = buckets('year', chartStart, today);
    const chart = new Map(months.map((m) => [m.key, { month: m.label, sales: 0, purchases: 0 }]));
    for (const d of chartDocs) {
      const row = chart.get(toISODate(d.issueDate)!.slice(0, 7));
      if (!row) continue;
      const total = Number(d.total);
      if (d.docType === 'sales_invoice') row.sales += total;
      else if (d.docType === 'sales_return' && d.approvalStatus === 'approved') row.sales -= total;
      else if (d.docType === 'purchase_bill') row.purchases += total;
      else if (d.docType === 'purchase_return') row.purchases -= total;
    }

    const monthSalesTotal = Number(monthSales._sum.total ?? 0);
    const lastMonthTotal = Number(lastMonthSales._sum.total ?? 0);
    const openBy = (t: string) => open.find((o) => o.docType === t);
    const overdueParties = receivables.parties.filter((p) => p.overdue_amount > 0);

    const result = {
      as_of: today,
      today: {
        sales: Number(todaySales._sum.total ?? 0),
        sales_count: todaySales._count,
        collections: round2(Number(todayCollections._sum.amount ?? 0) + Number(todayCashSales._sum.total ?? 0)),
      },
      month: {
        sales: monthSalesTotal,
        sales_count: monthSales._count,
        returns: Number(monthReturns._sum.total ?? 0),
        purchases: Number(monthPurchases._sum.total ?? 0),
        purchase_count: monthPurchases._count,
        collections: round2(Number(monthCollections._sum.amount ?? 0) + Number(monthCashSales._sum.total ?? 0)),
        last_month_to_date: lastMonthTotal,
        trend_percent: lastMonthTotal > 0 ? Math.round(((monthSalesTotal - lastMonthTotal) / lastMonthTotal) * 100) : null,
      },
      receivables: {
        total: receivables.totals.outstanding,
        overdue: receivables.totals.overdue_amount,
        overdue_parties: overdueParties.length,
        buckets: receivables.totals.buckets,
      },
      payables: {
        total: payables.totals.outstanding,
        overdue: payables.totals.overdue_amount,
      },
      stock: {
        item_count: stock.totals.item_count,
        total_qty: stock.totals.total_qty,
        value_at_cost: round2(stock.totals.value_at_cost),
        value_at_price: round2(stock.totals.value_at_price),
        low_count: stock.totals.low_count,
        out_count: stock.totals.out_count,
        damaged_qty: stock.totals.total_damaged,
        low_items: stock.items,
      },
      approvals: {
        count: await prisma.invoice.count({ where: { orgId, approvalStatus: 'pending', status: { not: 'cancelled' } } }),
        items: pending.map((p) => ({
          id: p.id, doc_type: p.docType, invoice_number: p.invoiceNumber, party_name: p.client?.name ?? p.partyName,
          total: Number(p.total), issue_date: toISODate(p.issueDate),
        })),
      },
      open_documents: {
        estimates: { count: openBy('estimate')?._count ?? 0, total: Number(openBy('estimate')?._sum.total ?? 0) },
        challans: { count: openBy('delivery_challan')?._count ?? 0, total: Number(openBy('delivery_challan')?._sum.total ?? 0) },
        binding_orders: { count: openBy('binding_order')?._count ?? 0, total: Number(openBy('binding_order')?._sum.total ?? 0) },
      },
      overdue_parties: overdueParties.slice(0, 6).map((p) => ({
        client_id: p.client_id, name: p.name, phone: p.phone, credit_days: p.credit_days,
        overdue_amount: p.overdue_amount, outstanding: p.outstanding, max_days_overdue: p.max_days_overdue,
      })),
      due_soon: dueSoon.map((d) => ({
        id: d.id, invoice_number: d.invoiceNumber, party_name: d.client?.name ?? d.partyName,
        due_date: toISODate(d.dueDate), days_to_due: diffDays(toISODate(d.dueDate)!, today),
        balance: round2(Number(d.total) - Number(d.amountPaid)),
      })),
      in_transit: inTransit.map((d) => ({
        id: d.id, doc_type: d.docType, invoice_number: d.invoiceNumber, party_name: d.client?.name ?? d.partyName,
        dispatch_mode: d.dispatchMode, carrier: d.dispatchMode === 'transport' ? d.transportName : d.courierName,
        tracking: d.dispatchMode === 'transport' ? d.lrNumber : d.trackingNumber,
        dispatch_date: toISODate(d.dispatchDate), expected_delivery_date: toISODate(d.expectedDeliveryDate),
        delivery_status: d.deliveryStatus,
      })),
      recent: recent.map((d) => ({
        id: d.id, doc_type: d.docType, invoice_number: d.invoiceNumber, status: d.status, approval_status: d.approvalStatus,
        party_name: d.client?.name ?? d.partyName, total: Number(d.total), issue_date: toISODate(d.issueDate), payment_mode: d.paymentMode,
      })),
      chart: [...chart.values()].map((c) => ({ ...c, sales: round2(c.sales), purchases: round2(c.purchases) })),
    };

    await cacheSet(key, result, 60);
    return result;
  }
}

export const analyticsService = new AnalyticsService();
