import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { docConfig } from '../lib/doc-types.js';
import { parseISODate, toISODate } from '../lib/dates.js';
import { AppError, notFound } from '../lib/errors.js';
import { numberingService } from './numbering.service.js';
import { ledgerService } from './ledger.service.js';
import { documentService } from './document.service.js';
import type { CreatePaymentInput, PaymentQuery, UpdatePaymentInput } from '../schemas/payment.schema.js';

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

const include = {
  client: { select: { id: true, name: true, company: true, phone: true } },
  invoice: { select: { id: true, invoiceNumber: true, docType: true, total: true, amountPaid: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof include }>;

function serialize(p: PaymentRow) {
  return {
    id: p.id,
    payment_number: p.paymentNumber,
    direction: p.direction,
    amount: Number(p.amount),
    payment_date: toISODate(p.paymentDate),
    mode: p.mode,
    reference: p.reference,
    notes: p.notes,
    client_id: p.clientId,
    invoice_id: p.invoiceId,
    party_name: p.client?.name ?? null,
    invoice_number: p.invoice?.invoiceNumber ?? null,
    invoice_doc_type: p.invoice?.docType ?? null,
    created_at: p.createdAt,
  };
}

export class PaymentService {
  /** Validates the party/bill pair and fills in the party from the bill when only a bill is given. */
  private async resolveTargets(tx: Tx, orgId: string, direction: 'in' | 'out', clientId?: string | null, invoiceId?: string | null) {
    let party = clientId ?? null;
    if (invoiceId) {
      const bill = await tx.invoice.findFirst({
        where: { id: invoiceId, orgId },
        select: { id: true, clientId: true, docType: true, status: true },
      });
      if (!bill) throw notFound('Bill');
      const cfg = docConfig(bill.docType);
      if (!cfg.isBill) throw new AppError('Payments can only be recorded against sales invoices or purchase bills', 422, 'INVALID_BILL');
      if (bill.status === 'cancelled') throw new AppError('This bill is cancelled', 422, 'INVALID_BILL');
      const expected = cfg.side === 'sales' ? 'in' : 'out';
      if (direction !== expected) {
        throw new AppError(
          cfg.side === 'sales' ? 'Use "Payment received" for a sales invoice' : 'Use "Payment made" for a purchase bill',
          422,
          'INVALID_DIRECTION'
        );
      }
      if (party && bill.clientId && party !== bill.clientId) {
        throw new AppError('The selected bill belongs to a different party', 422, 'PARTY_MISMATCH');
      }
      party = party ?? bill.clientId;
    }
    if (party) {
      const exists = await tx.client.count({ where: { id: party, orgId } });
      if (!exists) throw notFound('Party');
    }
    return { clientId: party, invoiceId: invoiceId ?? null };
  }

  async list(orgId: string, q: PaymentQuery) {
    const where: Prisma.PaymentWhereInput = {
      orgId,
      ...(q.direction && { direction: q.direction }),
      ...(q.client_id && { clientId: q.client_id }),
      ...(q.invoice_id && { invoiceId: q.invoice_id }),
      ...(q.mode && { mode: q.mode }),
      ...((q.from || q.to) && {
        paymentDate: {
          ...(q.from && { gte: parseISODate(q.from) }),
          ...(q.to && { lte: parseISODate(q.to) }),
        },
      }),
      ...(q.search && {
        OR: [
          { paymentNumber: { contains: q.search, mode: 'insensitive' } },
          { reference: { contains: q.search, mode: 'insensitive' } },
          { notes: { contains: q.search, mode: 'insensitive' } },
          { client: { name: { contains: q.search, mode: 'insensitive' } } },
          { invoice: { invoiceNumber: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [rows, total, inSum, outSum] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where: { ...where, direction: 'in' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...where, direction: 'out' }, _sum: { amount: true } }),
    ]);

    return {
      payments: rows.map(serialize),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      summary: {
        received: Number(inSum._sum.amount ?? 0),
        paid: Number(outSum._sum.amount ?? 0),
      },
    };
  }

  async get(orgId: string, id: string) {
    const p = await prisma.payment.findFirst({ where: { id, orgId }, include });
    if (!p) throw notFound('Payment');
    return serialize(p);
  }

  async create(orgId: string, userId: string, input: CreatePaymentInput) {
    const id = await prisma.$transaction(async (tx) => {
      const { clientId, invoiceId } = await this.resolveTargets(tx, orgId, input.direction, input.client_id, input.invoice_id);
      const date = parseISODate(input.payment_date);
      const created = await tx.payment.create({
        data: {
          orgId,
          userId,
          clientId,
          invoiceId,
          direction: input.direction,
          paymentNumber: await numberingService.allocate(tx, orgId, input.direction === 'in' ? 'payment_in' : 'payment_out', date),
          amount: input.amount,
          paymentDate: date,
          mode: input.mode,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
        },
        select: { id: true },
      });
      await ledgerService.recompute(tx, orgId, [clientId], invoiceId ?? undefined);
      return created.id;
    }, TX_OPTIONS);
    await documentService.invalidate(orgId);
    return this.get(orgId, id);
  }

  async update(orgId: string, id: string, input: UpdatePaymentInput) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({ where: { id, orgId } });
      if (!existing) throw notFound('Payment');
      const direction = (input.direction ?? existing.direction) as 'in' | 'out';
      const { clientId, invoiceId } = await this.resolveTargets(
        tx,
        orgId,
        direction,
        input.client_id !== undefined ? input.client_id : existing.clientId,
        input.invoice_id !== undefined ? input.invoice_id : existing.invoiceId
      );
      await tx.payment.update({
        where: { id },
        data: {
          clientId,
          invoiceId,
          direction,
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.payment_date !== undefined && { paymentDate: parseISODate(input.payment_date) }),
          ...(input.mode !== undefined && { mode: input.mode }),
          ...(input.reference !== undefined && { reference: input.reference }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });
      await ledgerService.recompute(tx, orgId, [clientId, existing.clientId]);
      for (const docId of new Set([invoiceId, existing.invoiceId])) {
        if (docId) await ledgerService.recomputeUnassignedDoc(tx, docId);
      }
    }, TX_OPTIONS);
    await documentService.invalidate(orgId);
    return this.get(orgId, id);
  }

  async delete(orgId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({ where: { id, orgId } });
      if (!existing) throw notFound('Payment');
      await tx.payment.delete({ where: { id } });
      await ledgerService.recompute(tx, orgId, [existing.clientId], existing.invoiceId ?? undefined);
    }, TX_OPTIONS);
    await documentService.invalidate(orgId);
    return { success: true };
  }
}

export const paymentService = new PaymentService();
