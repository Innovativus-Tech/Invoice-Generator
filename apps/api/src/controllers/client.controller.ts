import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, CacheKeys } from '../lib/cache.js';
import { AppError, notFound } from '../lib/errors.js';
import { route } from '../lib/http.js';
import { toISODate } from '../lib/dates.js';
import { ledgerService } from '../services/ledger.service.js';
import { documentService } from '../services/document.service.js';
import type { CreateClientInput, UpdateClientInput } from '../schemas/client.schema.js';

type ClientRow = Prisma.ClientGetPayload<object>;

function serializeClient(c: ClientRow) {
  return {
    id: c.id,
    user_id: c.userId,
    org_id: c.orgId,
    name: c.name,
    email: c.email,
    company: c.company,
    address: c.address,
    phone: c.phone,
    notes: c.notes,
    gstin: c.gstin,
    state: c.state,
    state_code: c.stateCode,
    party_type: c.partyType,
    credit_days: c.creditDays,
    credit_limit: Number(c.creditLimit),
    opening_balance: Number(c.openingBalance),
    pincode: c.pincode,
    shipping_address: c.shippingAddress,
    shipping_state: c.shippingState,
    shipping_pincode: c.shippingPincode,
    created_at: c.createdAt,
  };
}

const FIELD_MAP: Record<string, keyof Prisma.ClientUncheckedUpdateInput> = {
  name: 'name',
  email: 'email',
  company: 'company',
  address: 'address',
  phone: 'phone',
  notes: 'notes',
  gstin: 'gstin',
  state: 'state',
  state_code: 'stateCode',
  party_type: 'partyType',
  credit_days: 'creditDays',
  credit_limit: 'creditLimit',
  opening_balance: 'openingBalance',
  pincode: 'pincode',
  shipping_address: 'shippingAddress',
  shipping_state: 'shippingState',
  shipping_pincode: 'shippingPincode',
};

function toData(input: CreateClientInput | UpdateClientInput) {
  const data: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) data[column] = key === 'gstin' && typeof value === 'string' ? value.toUpperCase() : value;
  }
  return data;
}

const SUPPLIER_TYPES = ['supplier', 'binder', 'both'];
const CUSTOMER_TYPES = ['customer', 'both'];

const invalidate = (orgId: string) => documentService.invalidate(orgId);

export const clientController = {
  /** Parties with live balances. `?type=customer|supplier` narrows the list for pickers. */
  list: route(async (req) => {
    const type = req.query.type as string | undefined;
    const key = `${CacheKeys.clients(req.org.id)}:${type ?? 'all'}`;
    const cached = await cacheGet<unknown[]>(key);
    if (cached) return cached;

    const where: Prisma.ClientWhereInput = { orgId: req.org.id };
    if (type === 'customer') where.partyType = { in: CUSTOMER_TYPES };
    if (type === 'supplier') where.partyType = { in: SUPPLIER_TYPES };

    const [clients, balances, sales, purchases] = await Promise.all([
      prisma.client.findMany({ where, orderBy: { name: 'asc' } }),
      ledgerService.getBalances(req.org.id),
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: { orgId: req.org.id, docType: 'sales_invoice', status: { not: 'cancelled' }, clientId: { not: null } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: { orgId: req.org.id, docType: 'purchase_bill', status: { not: 'cancelled' }, clientId: { not: null } },
        _sum: { total: true },
      }),
    ]);
    const salesBy = new Map(sales.map((s) => [s.clientId, s]));
    const purchasesBy = new Map(purchases.map((p) => [p.clientId, p]));

    const result = clients.map((c) => {
      const balance = balances.get(c.id) ?? Number(c.openingBalance);
      return {
        ...serializeClient(c),
        balance,
        outstanding: balance > 0 ? balance : 0,
        payable: balance < 0 ? -balance : 0,
        totalInvoiced: Number(salesBy.get(c.id)?._sum.total ?? 0),
        invoiceCount: salesBy.get(c.id)?._count ?? 0,
        totalPurchased: Number(purchasesBy.get(c.id)?._sum.total ?? 0),
      };
    });

    // Invalidated on every document / payment / party change.
    await cacheSet(key, result, 60);
    return result;
  }),

  get: route(async (req) => {
    const client = await prisma.client.findFirst({ where: { id: req.params.id, orgId: req.org.id } });
    if (!client) throw notFound('Party');

    const [documents, balances, receivable, payable, salesAgg, purchaseAgg] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: client.id, orgId: req.org.id },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        select: {
          id: true, docType: true, invoiceNumber: true, status: true, approvalStatus: true, issueDate: true,
          dueDate: true, total: true, amountPaid: true, paymentMode: true, currency: true, createdAt: true,
        },
      }),
      ledgerService.getBalances(req.org.id, [client.id]),
      ledgerService.getOutstanding(req.org.id, 'receivable', client.id),
      ledgerService.getOutstanding(req.org.id, 'payable', client.id),
      prisma.invoice.aggregate({
        where: { clientId: client.id, orgId: req.org.id, docType: 'sales_invoice', status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { clientId: client.id, orgId: req.org.id, docType: 'purchase_bill', status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
    ]);

    const balance = balances.get(client.id) ?? Number(client.openingBalance);
    const recv = receivable.parties[0];
    const pay = payable.parties[0];

    return {
      ...serializeClient(client),
      balance,
      outstanding: balance > 0 ? balance : 0,
      payable: balance < 0 ? -balance : 0,
      totalInvoiced: Number(salesAgg._sum.total ?? 0),
      totalPurchased: Number(purchaseAgg._sum.total ?? 0),
      overdue_amount: recv?.overdue_amount ?? 0,
      max_days_overdue: recv?.max_days_overdue ?? 0,
      next_due_date: recv?.next_due_date ?? null,
      open_bills: [...(recv?.items ?? []), ...(pay?.items ?? [])],
      invoices: documents.map((d) => ({
        id: d.id,
        doc_type: d.docType,
        invoice_number: d.invoiceNumber,
        status: d.status,
        approval_status: d.approvalStatus,
        issue_date: toISODate(d.issueDate),
        due_date: toISODate(d.dueDate),
        total: Number(d.total),
        amount_paid: Number(d.amountPaid),
        payment_mode: d.paymentMode,
        currency: d.currency,
        created_at: d.createdAt,
      })),
    };
  }),

  /** Party account statement with running balance. */
  ledger: route(async (req) => {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : undefined;
    return ledgerService.getLedger(req.org.id, req.params.id, from, to);
  }),

  create: route(async (req) => {
    const input = req.body as CreateClientInput;
    const client = await prisma.client.create({
      data: { ...(toData(input) as Prisma.ClientUncheckedCreateInput), name: input.name, userId: req.userId, orgId: req.org.id },
    });
    await invalidate(req.org.id);
    return serializeClient(client);
  }, { status: 201 }),

  update: route(async (req) => {
    const input = req.body as UpdateClientInput;
    const result = await prisma.client.updateMany({ where: { id: req.params.id, orgId: req.org.id }, data: toData(input) });
    if (result.count === 0) throw notFound('Party');
    if (input.opening_balance !== undefined) {
      // Opening balance takes part in bill-wise settlement.
      await prisma.$transaction((tx) => ledgerService.recomputeParty(tx, req.org.id, req.params.id), { timeout: 30_000 });
    }
    await invalidate(req.org.id);
    const client = await prisma.client.findFirstOrThrow({ where: { id: req.params.id, orgId: req.org.id } });
    return serializeClient(client);
  }),

  delete: route(async (req) => {
    const client = await prisma.client.findFirst({ where: { id: req.params.id, orgId: req.org.id }, select: { id: true } });
    if (!client) throw notFound('Party');
    const [docs, payments] = await Promise.all([
      prisma.invoice.count({ where: { clientId: client.id } }),
      prisma.payment.count({ where: { clientId: client.id } }),
    ]);
    if (docs + payments > 0) {
      throw new AppError(
        `This party has ${docs} document(s) and ${payments} payment(s). Delete or move them first so the ledger stays correct.`,
        409,
        'PARTY_IN_USE'
      );
    }
    await prisma.client.delete({ where: { id: client.id } });
    await invalidate(req.org.id);
    return { success: true };
  }),
};
