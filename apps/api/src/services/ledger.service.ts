import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { DOC_TYPE_CONFIG, DOC_TYPES, docConfig, hasLedgerEffect } from '../lib/doc-types.js';
import { settle, type SettlementItem } from '../lib/settlement.js';
import { round2 } from '../lib/totals.js';
import { diffDays, toISODate, todayISO } from '../lib/dates.js';

type Db = Prisma.TransactionClient | typeof prisma;

const LEDGER_DOC_TYPES = DOC_TYPES.filter((t) => DOC_TYPE_CONFIG[t].ledger !== 'none');
const BILL_TYPES = DOC_TYPES.filter((t) => DOC_TYPE_CONFIG[t].isBill);

const docSelect = {
  id: true,
  orgId: true,
  clientId: true,
  docType: true,
  invoiceNumber: true,
  status: true,
  approvalStatus: true,
  affectsStock: true,
  paymentMode: true,
  issueDate: true,
  dueDate: true,
  total: true,
  amountPaid: true,
  sourceDocId: true,
  sentAt: true,
  paidAt: true,
  createdAt: true,
  partyName: true,
} satisfies Prisma.InvoiceSelect;

type LedgerDoc = Prisma.InvoiceGetPayload<{ select: typeof docSelect }>;

const paymentSelect = {
  id: true,
  clientId: true,
  invoiceId: true,
  direction: true,
  paymentNumber: true,
  amount: true,
  paymentDate: true,
  mode: true,
  reference: true,
  notes: true,
  createdAt: true,
  invoice: { select: { invoiceNumber: true } },
} satisfies Prisma.PaymentSelect;

type LedgerPayment = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

interface PartyInfo {
  id: string;
  name: string;
  phone: string | null;
  partyType: string;
  creditDays: number;
  creditLimit: Prisma.Decimal;
  openingBalance: Prisma.Decimal;
  createdAt: Date;
}

export interface LedgerEntry {
  key: string;
  kind: 'opening' | 'document' | 'payment' | 'cash_settlement';
  date: string;
  seq: number;
  doc_id: string | null;
  doc_type: string | null;
  payment_id: string | null;
  number: string | null;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  due_date?: string | null;
  status?: string;
}

export interface OpenItem {
  key: string;
  kind: 'opening' | 'document' | 'payment';
  doc_id: string | null;
  doc_type: string | null;
  payment_id: string | null;
  number: string | null;
  description: string;
  date: string;
  due_date: string;
  amount: number;
  outstanding: number;
  days_overdue: number;
  days_to_due: number;
}

export interface PartyOutstanding {
  client_id: string | null;
  name: string;
  phone: string | null;
  party_type: string;
  credit_days: number;
  credit_limit: number;
  balance: number;
  outstanding: number;
  overdue_amount: number;
  max_days_overdue: number;
  oldest_due_date: string | null;
  next_due_date: string | null;
  buckets: Buckets;
  items: OpenItem[];
}

interface Buckets {
  not_due: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

const emptyBuckets = (): Buckets => ({ not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });

function bucketFor(daysOverdue: number): keyof Buckets {
  if (daysOverdue <= 0) return 'not_due';
  if (daysOverdue <= 30) return 'd1_30';
  if (daysOverdue <= 60) return 'd31_60';
  if (daysOverdue <= 90) return 'd61_90';
  return 'd90_plus';
}

const MODE_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank: 'Bank', cheque: 'Cheque', card: 'Card', other: 'Other' };

const isCashBill = (d: LedgerDoc) => docConfig(d.docType).isBill && d.paymentMode === 'cash';

/** Builds ledger entries for one party. Cash bills appear with a matching settlement line. */
function buildEntries(party: PartyInfo | null, docs: LedgerDoc[], payments: LedgerPayment[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  if (party && Number(party.openingBalance) !== 0) {
    const ob = Number(party.openingBalance);
    // Brought-forward balance always precedes every recorded transaction.
    const dates = [
      toISODate(party.createdAt)!,
      ...docs.map((d) => toISODate(d.issueDate)!),
      ...payments.map((p) => toISODate(p.paymentDate)!),
    ];
    entries.push({
      key: 'opening',
      kind: 'opening',
      date: dates.reduce((min, d) => (d < min ? d : min)),
      seq: 0,
      doc_id: null,
      doc_type: null,
      payment_id: null,
      number: null,
      description: 'Opening Balance',
      debit: ob > 0 ? ob : 0,
      credit: ob < 0 ? -ob : 0,
    });
  }

  for (const d of docs) {
    if (!hasLedgerEffect(d)) continue;
    const cfg = docConfig(d.docType);
    const amount = Number(d.total);
    const date = toISODate(d.issueDate)!;
    const seq = d.createdAt.getTime();
    entries.push({
      key: `doc:${d.id}`,
      kind: 'document',
      date,
      seq,
      doc_id: d.id,
      doc_type: d.docType,
      payment_id: null,
      number: d.invoiceNumber,
      description: `${cfg.label}${d.paymentMode === 'cash' && cfg.isBill ? ' (Cash)' : ''}`,
      debit: cfg.ledger === 'debit' ? amount : 0,
      credit: cfg.ledger === 'credit' ? amount : 0,
      due_date: toISODate(d.dueDate),
      status: d.status,
    });
    if (isCashBill(d)) {
      entries.push({
        key: `cash:${d.id}`,
        kind: 'cash_settlement',
        date,
        seq: seq + 1,
        doc_id: d.id,
        doc_type: d.docType,
        payment_id: null,
        number: d.invoiceNumber,
        description: cfg.ledger === 'debit' ? 'Cash received' : 'Cash paid',
        debit: cfg.ledger === 'credit' ? amount : 0,
        credit: cfg.ledger === 'debit' ? amount : 0,
      });
    }
  }

  for (const p of payments) {
    const amount = Number(p.amount);
    const modeLabel = MODE_LABEL[p.mode] ?? p.mode;
    const against = p.invoice?.invoiceNumber ? ` against ${p.invoice.invoiceNumber}` : '';
    entries.push({
      key: `pay:${p.id}`,
      kind: 'payment',
      date: toISODate(p.paymentDate)!,
      seq: p.createdAt.getTime(),
      doc_id: p.invoiceId,
      doc_type: null,
      payment_id: p.id,
      number: p.paymentNumber,
      description: `${p.direction === 'in' ? 'Payment received' : 'Payment made'} (${modeLabel})${against}${p.reference ? ` · ${p.reference}` : ''}`,
      debit: p.direction === 'out' ? amount : 0,
      credit: p.direction === 'in' ? amount : 0,
    });
  }

  return entries.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq));
}

/** Converts ledger entries into settlement items. Cash bills settle themselves and are left out. */
function settlementItems(entries: LedgerEntry[], docs: LedgerDoc[], payments: LedgerPayment[]): SettlementItem[] {
  const docById = new Map(docs.map((d) => [d.id, d]));
  const payById = new Map(payments.map((p) => [p.id, p]));
  const items: SettlementItem[] = [];

  for (const e of entries) {
    if (e.kind === 'cash_settlement') continue;
    if (e.kind === 'document' && e.doc_id && isCashBill(docById.get(e.doc_id)!)) continue;

    let targetKey: string | null = null;
    if (e.kind === 'payment' && e.payment_id) {
      const p = payById.get(e.payment_id);
      if (p?.invoiceId) targetKey = `doc:${p.invoiceId}`;
    } else if (e.kind === 'document' && e.doc_id) {
      const d = docById.get(e.doc_id)!;
      if (d.sourceDocId && !docConfig(d.docType).isBill) targetKey = `doc:${d.sourceDocId}`;
    }

    items.push({
      key: e.key,
      side: e.debit > 0 ? 'debit' : 'credit',
      date: e.date,
      amount: e.debit > 0 ? e.debit : e.credit,
      targetKey,
      seq: e.seq,
    });
  }
  return items;
}

function nextBillState(doc: LedgerDoc, amountPaid: number) {
  const total = Number(doc.total);
  const settled = total > 0 && amountPaid >= total - 0.005;
  let status = doc.status;
  let paidAt = doc.paidAt;
  if (['cancelled', 'converted'].includes(doc.status)) return { status, paidAt };
  if (settled && doc.status !== 'paid') {
    status = 'paid';
    paidAt = doc.paymentMode === 'cash' ? doc.issueDate : new Date();
  } else if (!settled && doc.status === 'paid') {
    status = doc.sentAt ? 'sent' : 'draft';
    paidAt = null;
  }
  return { status, paidAt };
}

async function applyBillState(db: Db, doc: LedgerDoc, amountPaid: number) {
  const paid = round2(Math.min(Math.max(amountPaid, 0), Number(doc.total)));
  const { status, paidAt } = nextBillState(doc, paid);
  const changed =
    Math.abs(Number(doc.amountPaid) - paid) > 0.004 ||
    status !== doc.status ||
    (paidAt?.getTime() ?? null) !== (doc.paidAt?.getTime() ?? null);
  if (!changed) return;
  await db.invoice.update({ where: { id: doc.id }, data: { amountPaid: paid, status, paidAt } });
}

function ledgerSignSql(): Prisma.Sql {
  const cases = LEDGER_DOC_TYPES.map((t) => {
    const cfg = DOC_TYPE_CONFIG[t];
    const sign = cfg.ledger === 'debit' ? '' : '-';
    const approval = cfg.requiresApproval ? ` AND approval_status = 'approved'` : '';
    return `WHEN doc_type = '${t}'${approval} THEN ${sign}total`;
  });
  // Cash bills are settled on the spot, so they net to zero in the party balance.
  const cashBills = BILL_TYPES.map((t) => `'${t}'`).join(', ');
  return Prisma.raw(
    `CASE WHEN payment_mode = 'cash' AND doc_type IN (${cashBills}) THEN 0 ${cases.join(' ')} ELSE 0 END`
  );
}

export class LedgerService {
  private async loadParty(db: Db, orgId: string, clientId: string) {
    const party = await db.client.findFirst({
      where: { id: clientId, orgId },
      select: {
        id: true, name: true, phone: true, partyType: true, creditDays: true,
        creditLimit: true, openingBalance: true, createdAt: true,
      },
    });
    if (!party) return null;
    const [docs, payments] = await Promise.all([
      db.invoice.findMany({
        where: { orgId, clientId, docType: { in: LEDGER_DOC_TYPES }, status: { not: 'cancelled' } },
        select: docSelect,
      }),
      db.payment.findMany({ where: { orgId, clientId }, select: paymentSelect }),
    ]);
    return { party, docs, payments };
  }

  /** Recomputes amount paid / status of every bill of a party. Call after any ledger change. */
  async recomputeParty(db: Db, orgId: string, clientId: string) {
    const data = await this.loadParty(db, orgId, clientId);
    if (!data) return;
    const entries = buildEntries(data.party, data.docs, data.payments);
    const { remaining } = settle(settlementItems(entries, data.docs, data.payments));

    for (const doc of data.docs) {
      if (!docConfig(doc.docType).isBill) continue;
      if (!hasLedgerEffect(doc)) continue;
      const paid = isCashBill(doc) ? Number(doc.total) : Number(doc.total) - (remaining.get(`doc:${doc.id}`) ?? Number(doc.total));
      await applyBillState(db, doc, paid);
    }
  }

  /** Bills without a party (walk-in) are settled only by payments made against them. */
  async recomputeUnassignedDoc(db: Db, docId: string) {
    const doc = await db.invoice.findUnique({ where: { id: docId }, select: docSelect });
    if (!doc || doc.clientId || !docConfig(doc.docType).isBill || doc.status === 'cancelled') return;
    let paid = Number(doc.total);
    if (doc.paymentMode !== 'cash') {
      const agg = await db.payment.aggregate({ where: { invoiceId: doc.id }, _sum: { amount: true } });
      paid = Number(agg._sum.amount ?? 0);
    }
    await applyBillState(db, doc, paid);
  }

  async recompute(db: Db, orgId: string, clientIds: (string | null | undefined)[], docId?: string) {
    const unique = [...new Set(clientIds.filter((c): c is string => !!c))];
    for (const clientId of unique) await this.recomputeParty(db, orgId, clientId);
    if (docId) await this.recomputeUnassignedDoc(db, docId);
  }

  async getLedger(orgId: string, clientId: string, from?: string, to?: string) {
    const data = await this.loadParty(prisma, orgId, clientId);
    if (!data) throw Object.assign(new Error('Party not found'), { status: 404 });

    const all = buildEntries(data.party, data.docs, data.payments);
    let opening = 0;
    const inRange: LedgerEntry[] = [];
    for (const e of all) {
      if (from && e.date < from) {
        opening += e.debit - e.credit;
        continue;
      }
      if (to && e.date > to) continue;
      inRange.push(e);
    }

    let balance = round2(opening);
    let totalDebit = 0;
    let totalCredit = 0;
    for (const e of inRange) {
      balance = round2(balance + e.debit - e.credit);
      e.balance = balance;
      totalDebit += e.debit;
      totalCredit += e.credit;
    }

    return {
      party: {
        id: data.party.id,
        name: data.party.name,
        phone: data.party.phone,
        party_type: data.party.partyType,
        credit_days: data.party.creditDays,
        credit_limit: Number(data.party.creditLimit),
      },
      from: from ?? null,
      to: to ?? null,
      opening_balance: round2(opening),
      total_debit: round2(totalDebit),
      total_credit: round2(totalCredit),
      closing_balance: balance,
      entries: inRange.map(({ seq: _seq, key: _key, ...rest }) => rest),
    };
  }

  /** Signed balance per party (+ party owes us, − we owe the party). */
  async getBalances(orgId: string, clientIds?: string[]): Promise<Map<string, number>> {
    const filter = clientIds?.length ? Prisma.sql`AND client_id IN (${Prisma.join(clientIds.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty;
    const [docRows, payRows, openings] = await Promise.all([
      prisma.$queryRaw<{ client_id: string; amount: number }[]>`
        SELECT client_id, COALESCE(SUM(${ledgerSignSql()}), 0)::float AS amount
        FROM invoices
        WHERE org_id = ${orgId}::uuid AND client_id IS NOT NULL AND status <> 'cancelled' ${filter}
        GROUP BY client_id
      `,
      prisma.$queryRaw<{ client_id: string; amount: number }[]>`
        SELECT client_id, COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE -amount END), 0)::float AS amount
        FROM payments
        WHERE org_id = ${orgId}::uuid AND client_id IS NOT NULL ${filter}
        GROUP BY client_id
      `,
      prisma.client.findMany({
        where: { orgId, ...(clientIds?.length && { id: { in: clientIds } }) },
        select: { id: true, openingBalance: true },
      }),
    ]);

    const balances = new Map<string, number>();
    for (const c of openings) balances.set(c.id, Number(c.openingBalance));
    for (const r of [...docRows, ...payRows]) balances.set(r.client_id, (balances.get(r.client_id) ?? 0) + Number(r.amount));
    for (const [k, v] of balances) balances.set(k, round2(v));
    return balances;
  }

  /** Bill-wise outstanding with due dates and overdue days. */
  async getOutstanding(orgId: string, side: 'receivable' | 'payable', clientId?: string) {
    const today = todayISO();
    const [parties, docs, payments] = await Promise.all([
      prisma.client.findMany({
        where: { orgId, ...(clientId && { id: clientId }) },
        select: {
          id: true, name: true, phone: true, partyType: true, creditDays: true,
          creditLimit: true, openingBalance: true, createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: { orgId, docType: { in: LEDGER_DOC_TYPES }, status: { not: 'cancelled' }, ...(clientId && { clientId }) },
        select: docSelect,
      }),
      prisma.payment.findMany({ where: { orgId, ...(clientId && { clientId }) }, select: paymentSelect }),
    ]);

    const docsByParty = new Map<string, LedgerDoc[]>();
    const unassigned: LedgerDoc[] = [];
    for (const d of docs) {
      if (d.clientId) docsByParty.set(d.clientId, [...(docsByParty.get(d.clientId) ?? []), d]);
      else unassigned.push(d);
    }
    const paysByParty = new Map<string, LedgerPayment[]>();
    for (const p of payments) {
      if (p.clientId) paysByParty.set(p.clientId, [...(paysByParty.get(p.clientId) ?? []), p]);
    }

    const wantSide = side === 'receivable' ? 'debit' : 'credit';
    const results: PartyOutstanding[] = [];

    for (const party of parties) {
      const pDocs = docsByParty.get(party.id) ?? [];
      const pPays = paysByParty.get(party.id) ?? [];
      const entries = buildEntries(party, pDocs, pPays);
      if (entries.length === 0) continue;
      const items = settlementItems(entries, pDocs, pPays);
      const { remaining } = settle(items);
      const balance = round2(entries.reduce((s, e) => s + e.debit - e.credit, 0));
      const docById = new Map(pDocs.map((d) => [d.id, d]));
      const entryByKey = new Map(entries.map((e) => [e.key, e]));

      const open: OpenItem[] = [];
      for (const item of items) {
        const rem = remaining.get(item.key) ?? 0;
        if (rem <= 0 || item.side !== wantSide) continue;
        const entry = entryByKey.get(item.key)!;
        const doc = entry.doc_id && entry.kind === 'document' ? docById.get(entry.doc_id) : undefined;
        const dueDate = doc ? toISODate(doc.dueDate) ?? entry.date : entry.date;
        const overdue = diffDays(today, dueDate);
        open.push({
          key: item.key,
          kind: entry.kind === 'cash_settlement' ? 'document' : entry.kind,
          doc_id: doc?.id ?? null,
          doc_type: doc?.docType ?? null,
          payment_id: entry.payment_id,
          number: entry.number,
          description: entry.kind === 'payment' ? (side === 'receivable' ? 'Advance paid' : 'Advance received') : entry.description,
          date: entry.date,
          due_date: dueDate,
          amount: item.amount,
          outstanding: rem,
          days_overdue: Math.max(overdue, 0),
          days_to_due: Math.max(-overdue, 0),
        });
      }
      if (open.length === 0) continue;
      results.push(summarise(
        {
          client_id: party.id,
          name: party.name,
          phone: party.phone,
          party_type: party.partyType,
          credit_days: party.creditDays,
          credit_limit: Number(party.creditLimit),
        },
        balance,
        open
      ));
    }

    // Walk-in credit bills with no party attached.
    const wantType = side === 'receivable' ? 'sales_invoice' : 'purchase_bill';
    const walkIn: OpenItem[] = [];
    for (const d of unassigned) {
      if (d.docType !== wantType || d.paymentMode === 'cash') continue;
      const rem = round2(Number(d.total) - Number(d.amountPaid));
      if (rem <= 0.005) continue;
      const dueDate = toISODate(d.dueDate) ?? toISODate(d.issueDate)!;
      const overdue = diffDays(today, dueDate);
      walkIn.push({
        key: `doc:${d.id}`,
        kind: 'document',
        doc_id: d.id,
        doc_type: d.docType,
        payment_id: null,
        number: d.invoiceNumber,
        description: `${docConfig(d.docType).label}${d.partyName ? ` · ${d.partyName}` : ''}`,
        date: toISODate(d.issueDate)!,
        due_date: dueDate,
        amount: Number(d.total),
        outstanding: rem,
        days_overdue: Math.max(overdue, 0),
        days_to_due: Math.max(-overdue, 0),
      });
    }
    if (walkIn.length > 0) {
      const sum = round2(walkIn.reduce((s, i) => s + i.outstanding, 0));
      results.push(summarise(
        { client_id: null, name: 'No party (walk-in)', phone: null, party_type: 'customer', credit_days: 0, credit_limit: 0 },
        side === 'receivable' ? sum : -sum,
        walkIn
      ));
    }

    results.sort((a, b) => b.overdue_amount - a.overdue_amount || b.outstanding - a.outstanding);

    const totals = results.reduce(
      (acc, r) => {
        acc.outstanding += r.outstanding;
        acc.overdue_amount += r.overdue_amount;
        for (const k of Object.keys(acc.buckets) as (keyof Buckets)[]) acc.buckets[k] += r.buckets[k];
        return acc;
      },
      { outstanding: 0, overdue_amount: 0, buckets: emptyBuckets() }
    );
    totals.outstanding = round2(totals.outstanding);
    totals.overdue_amount = round2(totals.overdue_amount);
    for (const k of Object.keys(totals.buckets) as (keyof Buckets)[]) totals.buckets[k] = round2(totals.buckets[k]);

    return { side, as_of: today, parties: results, totals, party_count: results.length };
  }
}

function summarise(
  base: Pick<PartyOutstanding, 'client_id' | 'name' | 'phone' | 'party_type' | 'credit_days' | 'credit_limit'>,
  balance: number,
  items: OpenItem[]
): PartyOutstanding {
  items.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
  const buckets = emptyBuckets();
  let outstanding = 0;
  let overdue = 0;
  let maxDays = 0;
  for (const i of items) {
    outstanding += i.outstanding;
    buckets[bucketFor(i.days_overdue)] += i.outstanding;
    if (i.days_overdue > 0) {
      overdue += i.outstanding;
      maxDays = Math.max(maxDays, i.days_overdue);
    }
  }
  for (const k of Object.keys(buckets) as (keyof Buckets)[]) buckets[k] = round2(buckets[k]);
  const notDue = items.filter((i) => i.days_overdue === 0);
  return {
    ...base,
    balance,
    outstanding: round2(outstanding),
    overdue_amount: round2(overdue),
    max_days_overdue: maxDays,
    oldest_due_date: items[0]?.due_date ?? null,
    next_due_date: notDue[0]?.due_date ?? null,
    buckets,
    items,
  };
}

export const ledgerService = new LedgerService();
