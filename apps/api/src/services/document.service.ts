import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheDel, cacheDelPattern, CacheKeys } from '../lib/cache.js';
import { DOC_TYPE_CONFIG, DOC_TYPES, docConfig, type DocType } from '../lib/doc-types.js';
import { computeTotals, lineAmount, round2 } from '../lib/totals.js';
import { addDays, diffDays, parseISODate, toISODate, todayISO } from '../lib/dates.js';
import { AppError, notFound } from '../lib/errors.js';
import { numberingService } from './numbering.service.js';
import { stockService } from './stock.service.js';
import { ledgerService } from './ledger.service.js';
import type {
  CreateDocumentInput,
  DeliveryUpdateInput,
  DocumentLineInput,
  DocumentQuery,
  UpdateDocumentInput,
} from '../schemas/document.schema.js';

type Tx = Prisma.TransactionClient;

export interface Actor {
  id: string;
  role: 'owner' | 'admin' | 'staff';
}

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };
const DAMAGE_TRACKED: DocType[] = ['purchase_bill', 'sales_return', 'purchase_return'];
const APPROVER_ROLES = ['owner', 'admin'];

const detailInclude = {
  client: true,
  invoiceItems: { orderBy: { sortOrder: 'asc' } },
  sourceDoc: { select: { id: true, docType: true, invoiceNumber: true, status: true, issueDate: true } },
  derivedDocs: {
    select: { id: true, docType: true, invoiceNumber: true, status: true, total: true, issueDate: true, approvalStatus: true },
    orderBy: { createdAt: 'asc' },
  },
  payments: {
    select: { id: true, paymentNumber: true, direction: true, amount: true, paymentDate: true, mode: true, reference: true },
    orderBy: { paymentDate: 'asc' },
  },
} satisfies Prisma.InvoiceInclude;

type DetailDoc = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>;

const listInclude = {
  client: { select: { id: true, name: true, company: true, phone: true, email: true } },
} satisfies Prisma.InvoiceInclude;

const iso = toISODate;
const n = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));

// ─── Serialization ────────────────────────────────────────────────────────────

function paymentStatus(doc: { docType: string; status: string; total: Prisma.Decimal; amountPaid: Prisma.Decimal }) {
  if (!docConfig(doc.docType).isBill || doc.status === 'cancelled') return null;
  const total = n(doc.total);
  const paid = n(doc.amountPaid);
  if (total <= 0 || paid >= total - 0.005) return 'paid';
  return paid > 0.005 ? 'partial' : 'unpaid';
}

function serializeBase(d: Prisma.InvoiceGetPayload<{ include: typeof listInclude }> | DetailDoc) {
  const cfg = docConfig(d.docType);
  const total = n(d.total);
  const paid = n(d.amountPaid);
  const balanceDue = cfg.isBill && d.status !== 'cancelled' ? round2(Math.max(total - paid, 0)) : 0;
  const dueDate = iso(d.dueDate);
  const daysOverdue = balanceDue > 0 && dueDate ? Math.max(diffDays(todayISO(), dueDate), 0) : 0;

  return {
    id: d.id,
    user_id: d.userId,
    org_id: d.orgId,
    doc_type: d.docType,
    doc_label: cfg.label,
    invoice_number: d.invoiceNumber,
    status: d.status,
    issue_date: iso(d.issueDate)!,
    due_date: dueDate,
    client_id: d.clientId,
    payment_mode: d.paymentMode,
    party_name: d.partyName ?? d.client?.name ?? null,
    party_phone: d.partyPhone,
    credit_days: d.creditDays,
    billing_address: d.billingAddress,
    shipping_name: d.shippingName,
    shipping_address: d.shippingAddress,
    order_id: d.orderId,
    order_date: iso(d.orderDate),
    bill_number: d.billNumber,
    place_of_supply: d.placeOfSupply,
    supply_type: d.supplyType,
    currency: d.currency,
    notes: d.notes,
    terms: d.terms,
    subtotal: n(d.subtotal),
    tax_rate: n(d.taxRate),
    tax_amount: n(d.taxAmount),
    discount_amount: n(d.discountAmount),
    taxable_amount: round2(n(d.subtotal) - n(d.discountAmount)),
    extra_discount_type: d.extraDiscountType,
    extra_discount_value: n(d.extraDiscountValue),
    postage_charge: n(d.postageCharge),
    other_charges: n(d.otherCharges),
    other_charges_label: d.otherChargesLabel,
    apply_round_off: d.applyRoundOff,
    round_off: n(d.roundOff),
    total,
    amount_paid: paid,
    balance_due: balanceDue,
    payment_status: paymentStatus(d),
    days_overdue: daysOverdue,
    source_doc_id: d.sourceDocId,
    party_ref_number: d.partyRefNumber,
    party_ref_date: iso(d.partyRefDate),
    affects_stock: d.affectsStock,
    valid_until: iso(d.validUntil),
    reason: d.reason,
    approval_status: d.approvalStatus,
    approved_by: d.approvedBy,
    approved_at: d.approvedAt,
    rejection_reason: d.rejectionReason,
    dispatch_mode: d.dispatchMode,
    delivery_status: d.deliveryStatus,
    courier_name: d.courierName,
    tracking_number: d.trackingNumber,
    dispatch_date: iso(d.dispatchDate),
    expected_delivery_date: iso(d.expectedDeliveryDate),
    delivered_date: iso(d.deliveredDate),
    transport_name: d.transportName,
    lr_number: d.lrNumber,
    vehicle_number: d.vehicleNumber,
    cartons: d.cartons,
    freight_type: d.freightType,
    delivery_type: d.deliveryType,
    transport_details: d.transportDetails,
    pdf_url: d.pdfUrl,
    sent_at: d.sentAt,
    viewed_at: d.viewedAt,
    paid_at: d.paidAt,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    clients: d.client
      ? {
          id: d.client.id,
          name: d.client.name,
          email: d.client.email,
          company: d.client.company,
          phone: d.client.phone,
          ...('address' in d.client && {
            address: d.client.address,
            gstin: d.client.gstin,
            state: d.client.state,
            state_code: d.client.stateCode,
            credit_days: d.client.creditDays,
          }),
        }
      : null,
  };
}

function serializeDetail(d: DetailDoc) {
  return {
    ...serializeBase(d),
    items: d.invoiceItems.map((item) => ({
      id: item.id,
      invoice_id: item.invoiceId,
      item_id: item.itemId,
      description: item.description,
      quantity: n(item.quantity),
      unit_price: n(item.unitPrice),
      amount: n(item.amount),
      sort_order: item.sortOrder ?? 0,
      hsn_sac: item.hsnSac ?? '',
      gst_rate: item.gstRate == null ? 18 : n(item.gstRate),
      discount_percent: n(item.discountPercent),
      isbn: item.isbn,
      author: item.author,
      binding: item.binding,
      damaged_qty: n(item.damagedQty),
      binding_charge: n(item.bindingCharge),
    })),
    source_doc: d.sourceDoc
      ? {
          id: d.sourceDoc.id,
          doc_type: d.sourceDoc.docType,
          invoice_number: d.sourceDoc.invoiceNumber,
          status: d.sourceDoc.status,
          issue_date: iso(d.sourceDoc.issueDate),
        }
      : null,
    derived_docs: d.derivedDocs.map((x) => ({
      id: x.id,
      doc_type: x.docType,
      invoice_number: x.invoiceNumber,
      status: x.status,
      approval_status: x.approvalStatus,
      total: n(x.total),
      issue_date: iso(x.issueDate),
    })),
    payments: d.payments.map((p) => ({
      id: p.id,
      payment_number: p.paymentNumber,
      direction: p.direction,
      amount: n(p.amount),
      payment_date: iso(p.paymentDate),
      mode: p.mode,
      reference: p.reference,
    })),
  };
}

export type SerializedDocument = ReturnType<typeof serializeDetail>;

// ─── Input merging ────────────────────────────────────────────────────────────

type MergedInput = Omit<CreateDocumentInput, 'doc_type' | 'paid_now_amount' | 'paid_now_mode' | 'paid_now_reference'> & { doc_type: DocType };

function existingAsInput(d: DetailDoc): MergedInput {
  return {
    doc_type: d.docType as DocType,
    invoice_number: d.invoiceNumber,
    status: d.status as MergedInput['status'],
    issue_date: iso(d.issueDate)!,
    client_id: d.clientId,
    payment_mode: d.paymentMode as 'cash' | 'credit',
    party_name: d.partyName,
    party_phone: d.partyPhone,
    credit_days: d.creditDays,
    due_date: iso(d.dueDate),
    billing_address: d.billingAddress,
    shipping_name: d.shippingName,
    shipping_address: d.shippingAddress,
    order_id: d.orderId,
    order_date: iso(d.orderDate),
    bill_number: d.billNumber,
    place_of_supply: d.placeOfSupply,
    supply_type: (d.supplyType as 'IGST' | 'CGST_SGST') ?? 'IGST',
    currency: d.currency,
    notes: d.notes,
    terms: d.terms,
    party_ref_number: d.partyRefNumber,
    party_ref_date: iso(d.partyRefDate),
    extra_discount_type: d.extraDiscountType as 'percent' | 'amount',
    extra_discount_value: n(d.extraDiscountValue),
    postage_charge: n(d.postageCharge),
    other_charges: n(d.otherCharges),
    other_charges_label: d.otherChargesLabel,
    apply_round_off: d.applyRoundOff,
    source_doc_id: d.sourceDocId,
    affects_stock: d.affectsStock,
    valid_until: iso(d.validUntil),
    reason: d.reason,
    dispatch_mode: d.dispatchMode as MergedInput['dispatch_mode'],
    delivery_status: d.deliveryStatus as MergedInput['delivery_status'],
    courier_name: d.courierName,
    tracking_number: d.trackingNumber,
    dispatch_date: iso(d.dispatchDate),
    expected_delivery_date: iso(d.expectedDeliveryDate),
    delivered_date: iso(d.deliveredDate),
    transport_name: d.transportName,
    lr_number: d.lrNumber,
    vehicle_number: d.vehicleNumber,
    cartons: d.cartons,
    freight_type: d.freightType as MergedInput['freight_type'],
    delivery_type: d.deliveryType as MergedInput['delivery_type'],
    transport_details: d.transportDetails,
    items: d.invoiceItems.map((i) => ({
      item_id: i.itemId,
      description: i.description,
      quantity: n(i.quantity),
      unit_price: n(i.unitPrice),
      sort_order: i.sortOrder ?? 0,
      hsn_sac: i.hsnSac,
      gst_rate: i.gstRate == null ? null : n(i.gstRate),
      discount_percent: n(i.discountPercent),
      isbn: i.isbn,
      author: i.author,
      binding: i.binding,
      damaged_qty: n(i.damagedQty),
      binding_charge: n(i.bindingCharge),
    })),
  };
}

/** Overlays the fields the client actually sent onto the stored document. */
function overlay<T extends object>(base: T, patch: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Keys the client explicitly sent (undefined means "leave unchanged"). */
function sentKeys(input: object) {
  return new Set(Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k));
}

function composeAddress(...parts: (string | null | undefined)[]) {
  return parts.map((p) => p?.trim()).filter(Boolean).join(', ') || null;
}

const dateOrNull = (v: string | null | undefined) => (v ? parseISODate(v) : null);

// ─── Service ──────────────────────────────────────────────────────────────────

export class DocumentService {
  async list(orgId: string, q: DocumentQuery) {
    const types = q.type ? [q.type] : q.side ? DOC_TYPES.filter((t) => DOC_TYPE_CONFIG[t].side === q.side) : undefined;
    const where: Prisma.InvoiceWhereInput = {
      orgId,
      ...(types && { docType: { in: types } }),
      ...(q.status && { status: q.status }),
      ...(q.client_id && { clientId: q.client_id }),
      ...(q.approval_status && { approvalStatus: q.approval_status }),
      ...(q.delivery_status && { deliveryStatus: q.delivery_status }),
      ...(q.payment_mode && { paymentMode: q.payment_mode }),
      ...(q.unpaid === 'true' && { paymentMode: 'credit', status: { notIn: ['paid', 'cancelled'] } }),
      ...((q.from || q.to) && {
        issueDate: {
          ...(q.from && { gte: parseISODate(q.from) }),
          ...(q.to && { lte: parseISODate(q.to) }),
        },
      }),
      ...(q.search && {
        OR: [
          { invoiceNumber: { contains: q.search, mode: 'insensitive' } },
          { billNumber: { contains: q.search, mode: 'insensitive' } },
          { orderId: { contains: q.search, mode: 'insensitive' } },
          { partyName: { contains: q.search, mode: 'insensitive' } },
          { partyRefNumber: { contains: q.search, mode: 'insensitive' } },
          { trackingNumber: { contains: q.search, mode: 'insensitive' } },
          { lrNumber: { contains: q.search, mode: 'insensitive' } },
          { notes: { contains: q.search, mode: 'insensitive' } },
          { client: { name: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const sortField = {
      issue_date: 'issueDate',
      created_at: 'createdAt',
      total: 'total',
      invoice_number: 'invoiceNumber',
      due_date: 'dueDate',
    }[q.sort] as keyof Prisma.InvoiceOrderByWithRelationInput;

    const [rows, total, sums] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: listInclude,
        orderBy: [{ [sortField]: q.order }, { createdAt: q.order }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ where: { ...where, status: { not: 'cancelled' } }, _sum: { total: true, amountPaid: true } }),
    ]);

    return {
      documents: rows.map(serializeBase),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      summary: {
        total_amount: n(sums._sum.total),
        amount_paid: n(sums._sum.amountPaid),
      },
    };
  }

  async get(orgId: string, id: string) {
    const doc = await prisma.invoice.findFirst({ where: { id, orgId }, include: detailInclude });
    if (!doc) throw notFound('Document');
    return serializeDetail(doc);
  }

  async nextNumber(orgId: string, type: DocType) {
    return numberingService.peek(orgId, type);
  }

  async create(orgId: string, actor: Actor, input: CreateDocumentInput) {
    const { paid_now_amount, paid_now_mode, paid_now_reference, ...docInput } = input;
    const id = await prisma.$transaction(async (tx) => {
      const merged: MergedInput = { ...docInput, status: docInput.status ?? 'draft' };
      const docId = await this.save(tx, orgId, actor, merged, null, sentKeys(docInput));
      if (paid_now_amount && paid_now_amount > 0) {
        await this.recordAdvance(tx, orgId, actor, docId, paid_now_amount, paid_now_mode ?? 'cash', paid_now_reference ?? null);
      }
      return docId;
    }, TX_OPTIONS);
    await this.afterChange(orgId, id, actor);
    return this.get(orgId, id);
  }

  async update(orgId: string, actor: Actor, id: string, input: UpdateDocumentInput) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({ where: { id, orgId }, include: detailInclude });
      if (!existing) throw notFound('Document');
      const merged = overlay(existingAsInput(existing), input as Partial<MergedInput>);
      await this.save(tx, orgId, actor, merged, existing, sentKeys(input));
    }, TX_OPTIONS);
    await this.afterChange(orgId, id, actor, false);
    return this.get(orgId, id);
  }

  /** Shared create/update path: validates, computes totals, writes, then re-posts stock and ledger. */
  private async save(
    tx: Tx,
    orgId: string,
    actor: Actor,
    input: MergedInput,
    existing: DetailDoc | null,
    sent: Set<string>
  ): Promise<string> {
    const type = input.doc_type;
    const cfg = docConfig(type);

    const party = input.client_id
      ? await tx.client.findFirst({ where: { id: input.client_id, orgId } })
      : null;
    if (input.client_id && !party) throw notFound('Party');

    // Cash / credit
    const paymentMode = cfg.isBill ? input.payment_mode ?? 'credit' : 'credit';
    if (cfg.isBill && paymentMode === 'credit' && !party) {
      throw new AppError('Select a party for a credit bill. For walk-in customers choose Cash.', 422, 'PARTY_REQUIRED');
    }

    // Conversion source
    let source: DetailDoc | null = null;
    if (input.source_doc_id && input.source_doc_id !== existing?.sourceDocId) {
      source = await tx.invoice.findFirst({ where: { id: input.source_doc_id, orgId }, include: detailInclude });
      if (!source) throw notFound('Source document');
      if (!docConfig(source.docType).convertsTo.includes(type)) {
        throw new AppError(`A ${docConfig(source.docType).label} cannot be converted into a ${cfg.label}`, 422, 'INVALID_CONVERSION');
      }
      if (source.status === 'cancelled') throw new AppError('Cannot convert a cancelled document', 422, 'INVALID_CONVERSION');
    }

    // A field the client sent wins. If the party changed and a party-derived
    // field was not sent, it is re-defaulted from the new party.
    const partyChanged = !existing || existing.clientId !== (party?.id ?? null);
    const pick = <K extends keyof MergedInput>(key: K, partyDefault: MergedInput[K] | null | undefined) => {
      const value = partyChanged && !sent.has(key) ? null : input[key];
      return (value || partyDefault || null) as MergedInput[K] | null;
    };

    // Dates & credit terms
    const issueDate = input.issue_date;
    const sentCreditDays = sent.has('credit_days') ? input.credit_days : undefined;
    const creditDays = cfg.isBill && paymentMode === 'credit'
      ? sentCreditDays ?? (partyChanged ? party?.creditDays ?? 0 : existing!.creditDays)
      : 0;
    const termsChanged = !existing || issueDate !== iso(existing.issueDate) || creditDays !== existing.creditDays || paymentMode !== existing.paymentMode;
    let dueDate: string;
    if (!cfg.isBill || paymentMode === 'cash') dueDate = issueDate;
    else if (sent.has('due_date') && input.due_date) dueDate = input.due_date;
    else if (existing?.dueDate && !termsChanged) dueDate = iso(existing.dueDate)!;
    else dueDate = addDays(issueDate, creditDays);

    // Lines
    const lines = await this.prepareLines(tx, orgId, type, input.items);
    const totals = computeTotals({
      items: lines.map((l) => ({ quantity: n(l.quantity), unit_price: n(l.unitPrice), discount_percent: n(l.discountPercent), gst_rate: l.gstRate == null ? null : n(l.gstRate), binding_charge: n(l.bindingCharge) })),
      extra_discount_type: input.extra_discount_type,
      extra_discount_value: input.extra_discount_value,
      postage_charge: input.postage_charge,
      other_charges: input.other_charges,
      apply_round_off: input.apply_round_off,
    });

    // Document number
    let number = input.invoice_number?.trim() || '';
    if (!number) {
      if (existing) number = existing.invoiceNumber;
      else number = await numberingService.allocate(tx, orgId, type, parseISODate(issueDate));
    } else if (!existing || number !== existing.invoiceNumber) {
      const clash = await tx.invoice.findFirst({
        where: { orgId, docType: type, invoiceNumber: number, ...(existing && { id: { not: existing.id } }) },
        select: { id: true },
      });
      if (clash) throw new AppError(`${cfg.label} number ${number} already exists`, 409, 'DUPLICATE_NUMBER');
      await numberingService.registerManual(tx, orgId, type, number);
    }

    // Party snapshot — kept on the document so later party edits don't rewrite history.
    const partyName = pick('party_name', party?.name);
    // State is printed separately (with its GST state code), so it is left out here.
    const billingAddress = pick('billing_address', composeAddress(party?.address, party?.pincode));
    const shippingAddress = pick(
      'shipping_address',
      composeAddress(party?.shippingAddress, party?.shippingState, party?.shippingPincode) ?? billingAddress
    );

    // Status & approval
    let status: string = input.status ?? 'draft';
    if (status === 'converted' && existing?.status !== 'converted') status = existing?.status ?? 'draft';
    if (status === 'paid' && !cfg.isBill) status = 'draft';
    let approval: Pick<Prisma.InvoiceUncheckedCreateInput, 'approvalStatus' | 'approvedBy' | 'approvedAt' | 'rejectionReason'> = {};
    if (cfg.requiresApproval) {
      if (!existing) {
        approval = { approvalStatus: 'pending', approvedBy: null, approvedAt: null, rejectionReason: null };
      } else if (existing.approvalStatus === 'rejected' || (existing.approvalStatus === 'approved' && !APPROVER_ROLES.includes(actor.role))) {
        // Edits by staff (or resubmitting a rejected return) need a fresh approval.
        approval = { approvalStatus: 'pending', approvedBy: null, approvedAt: null, rejectionReason: null };
      }
    }

    const record = {
      invoiceNumber: number,
      status,
      issueDate: parseISODate(issueDate),
      dueDate: parseISODate(dueDate),
      clientId: party?.id ?? null,
      paymentMode,
      partyName,
      partyPhone: pick('party_phone', party?.phone),
      creditDays,
      billingAddress,
      shippingName: pick('shipping_name', party?.name ?? partyName),
      shippingAddress,
      orderId: input.order_id ?? null,
      orderDate: dateOrNull(input.order_date),
      billNumber: input.bill_number ?? null,
      placeOfSupply: pick('place_of_supply', party?.state),
      supplyType: input.supply_type ?? 'IGST',
      currency: input.currency ?? 'INR',
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      partyRefNumber: input.party_ref_number ?? null,
      partyRefDate: dateOrNull(input.party_ref_date),
      subtotal: totals.subtotal,
      taxAmount: totals.tax,
      discountAmount: totals.extraDiscount,
      extraDiscountType: input.extra_discount_type ?? 'percent',
      extraDiscountValue: input.extra_discount_value ?? 0,
      postageCharge: input.postage_charge ?? 0,
      otherCharges: input.other_charges ?? 0,
      otherChargesLabel: input.other_charges_label ?? null,
      applyRoundOff: input.apply_round_off ?? false,
      roundOff: totals.roundOff,
      total: totals.total,
      sourceDocId: input.source_doc_id ?? null,
      affectsStock: input.affects_stock ?? true,
      validUntil: type === 'estimate' ? dateOrNull(input.valid_until) : null,
      reason: input.reason ?? null,
      dispatchMode: input.dispatch_mode ?? 'none',
      deliveryStatus: input.delivery_status ?? 'pending',
      courierName: input.courier_name ?? null,
      trackingNumber: input.tracking_number ?? null,
      dispatchDate: dateOrNull(input.dispatch_date),
      expectedDeliveryDate: dateOrNull(input.expected_delivery_date),
      deliveredDate: dateOrNull(input.delivered_date),
      transportName: input.transport_name ?? null,
      lrNumber: input.lr_number ?? null,
      vehicleNumber: input.vehicle_number ?? null,
      cartons: input.cartons ?? null,
      freightType: input.freight_type ?? null,
      deliveryType: input.delivery_type ?? null,
      transportDetails: input.transport_details ?? null,
      ...approval,
    } satisfies Prisma.InvoiceUncheckedUpdateInput;

    let docId: string;
    if (existing) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoice.update({
        where: { id: existing.id },
        data: { ...record, invoiceItems: { createMany: { data: lines } } },
      });
      docId = existing.id;
    } else {
      const created = await tx.invoice.create({
        data: { ...record, orgId, userId: actor.id, docType: type, invoiceItems: { createMany: { data: lines } } },
        select: { id: true },
      });
      docId = created.id;
    }

    // Close the source (estimate / challan / binding order) once converted.
    if (source && docConfig(source.docType).closesOnConversion && source.status !== 'converted') {
      await tx.invoice.update({ where: { id: source.id }, data: { status: 'converted' } });
      await this.repost(tx, source.id, actor.id);
    }

    await this.repost(tx, docId, actor.id);
    await ledgerService.recompute(tx, orgId, [party?.id, existing?.clientId], docId);
    return docId;
  }

  /** Part payment made when a credit bill is created (e.g. advance paid to the binder). */
  private async recordAdvance(tx: Tx, orgId: string, actor: Actor, docId: string, amount: number, mode: string, reference: string | null) {
    const doc = await tx.invoice.findUniqueOrThrow({ where: { id: docId } });
    const cfg = docConfig(doc.docType);
    if (!cfg.isBill || doc.paymentMode !== 'credit') return;
    const paid = round2(Math.min(amount, n(doc.total)));
    if (paid <= 0) return;
    const today = parseISODate(todayISO());
    await tx.payment.create({
      data: {
        orgId,
        userId: actor.id,
        clientId: doc.clientId,
        invoiceId: doc.id,
        direction: cfg.side === 'sales' ? 'in' : 'out',
        paymentNumber: await numberingService.allocate(tx, orgId, cfg.side === 'sales' ? 'payment_in' : 'payment_out', today),
        amount: paid,
        paymentDate: doc.issueDate,
        mode,
        reference,
        notes: 'Paid at the time of billing',
      },
    });
    await ledgerService.recompute(tx, orgId, [doc.clientId], doc.id);
  }

  private async prepareLines(tx: Tx, orgId: string, type: DocType, items: DocumentLineInput[]) {
    const ids = [...new Set(items.map((i) => i.item_id).filter((x): x is string => !!x))];
    const known = ids.length
      ? new Set((await tx.inventoryItem.findMany({ where: { id: { in: ids }, orgId }, select: { id: true } })).map((r) => r.id))
      : new Set<string>();
    const tracksDamage = DAMAGE_TRACKED.includes(type);
    const chargesBinding = docConfig(type).side === 'purchase';

    return items.map((item, index) => ({
      orgId,
      itemId: item.item_id && known.has(item.item_id) ? item.item_id : null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      amount: lineAmount(item),
      sortOrder: index,
      hsnSac: item.hsn_sac ?? '',
      gstRate: item.gst_rate ?? 18,
      discountPercent: item.discount_percent ?? 0,
      isbn: item.isbn ?? null,
      author: item.author ?? null,
      binding: item.binding ?? null,
      damagedQty: tracksDamage ? Math.min(item.damaged_qty ?? 0, item.quantity) : 0,
      // Binding is charged by binders/suppliers, so only purchase-side documents carry it.
      bindingCharge: chargesBinding ? item.binding_charge ?? 0 : 0,
    }));
  }

  /** Re-applies a document's stock movements and purchase rates from its current state. */
  private async repost(tx: Tx, docId: string, userId: string | null) {
    const doc = await tx.invoice.findUnique({ where: { id: docId }, include: { invoiceItems: true } });
    if (!doc) return;
    await stockService.syncDocument(tx, doc, doc.invoiceItems, userId);
    if (doc.orgId) await stockService.updatePurchaseRates(tx, doc.orgId, doc, doc.invoiceItems);
  }

  async delete(orgId: string, actor: Actor, id: string) {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.invoice.findFirst({ where: { id, orgId }, include: { sourceDoc: true } });
      if (!doc) throw notFound('Document');

      await stockService.reverseDocument(tx, doc.id);
      await tx.invoice.delete({ where: { id: doc.id } });

      // Deleting the converted copy re-opens the estimate / challan / binding order.
      const src = doc.sourceDoc;
      if (src && src.status === 'converted' && docConfig(src.docType).closesOnConversion) {
        const remaining = await tx.invoice.count({ where: { sourceDocId: src.id } });
        if (remaining === 0) {
          await tx.invoice.update({ where: { id: src.id }, data: { status: src.sentAt ? 'sent' : 'draft' } });
          await this.repost(tx, src.id, actor.id);
        }
      }
      await ledgerService.recompute(tx, orgId, [doc.clientId]);
    }, TX_OPTIONS);
    await this.invalidate(orgId);
    return { success: true };
  }

  async updateStatus(orgId: string, actor: Actor, id: string, status: string) {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.invoice.findFirst({ where: { id, orgId } });
      if (!doc) throw notFound('Document');
      const cfg = docConfig(doc.docType);

      if (status === 'converted') throw new AppError('Convert the document instead of setting this status', 422, 'INVALID_STATUS');

      if (status === 'paid') {
        if (!cfg.isBill) throw new AppError(`A ${cfg.label} cannot be marked paid`, 422, 'INVALID_STATUS');
        if (doc.status === 'cancelled') throw new AppError('Cannot mark a cancelled bill as paid', 422, 'INVALID_STATUS');
        const balance = round2(n(doc.total) - n(doc.amountPaid));
        if (balance > 0.005) {
          const key = cfg.side === 'sales' ? 'payment_in' : 'payment_out';
          await tx.payment.create({
            data: {
              orgId,
              userId: actor.id,
              clientId: doc.clientId,
              invoiceId: doc.id,
              direction: cfg.side === 'sales' ? 'in' : 'out',
              paymentNumber: await numberingService.allocate(tx, orgId, key, parseISODate(todayISO())),
              amount: balance,
              paymentDate: parseISODate(todayISO()),
              mode: 'cash',
              notes: 'Recorded by "Mark as paid"',
            },
          });
        }
      } else {
        const data: Prisma.InvoiceUpdateInput = { status };
        if (status === 'sent' && !doc.sentAt) data.sentAt = new Date();
        if (status === 'viewed' && !doc.viewedAt) data.viewedAt = new Date();
        await tx.invoice.update({ where: { id: doc.id }, data });
        await this.repost(tx, doc.id, actor.id);
      }
      await ledgerService.recompute(tx, orgId, [doc.clientId], doc.id);
    }, TX_OPTIONS);
    await this.afterChange(orgId, id, actor, false);
    return this.get(orgId, id);
  }

  async approve(orgId: string, actor: Actor, id: string) {
    await this.setApproval(orgId, actor, id, 'approved', null);
    return this.get(orgId, id);
  }

  async reject(orgId: string, actor: Actor, id: string, reason: string) {
    await this.setApproval(orgId, actor, id, 'rejected', reason);
    return this.get(orgId, id);
  }

  private async setApproval(orgId: string, actor: Actor, id: string, decision: 'approved' | 'rejected', reason: string | null) {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.invoice.findFirst({ where: { id, orgId } });
      if (!doc) throw notFound('Document');
      if (!docConfig(doc.docType).requiresApproval) throw new AppError('This document does not need approval', 422, 'NO_APPROVAL');
      if (doc.status === 'cancelled') throw new AppError('Cannot approve a cancelled document', 422, 'INVALID_STATUS');
      if (doc.approvalStatus === decision) throw new AppError(`Already ${decision}`, 422, 'NO_CHANGE');

      await tx.invoice.update({
        where: { id: doc.id },
        data: {
          approvalStatus: decision,
          approvedBy: actor.id,
          approvedAt: new Date(),
          rejectionReason: decision === 'rejected' ? reason : null,
        },
      });
      await this.repost(tx, doc.id, actor.id);
      await ledgerService.recompute(tx, orgId, [doc.clientId], doc.id);
      await tx.notification.updateMany({
        where: { orgId, invoiceId: doc.id, type: 'approval_pending', isRead: false },
        data: { isRead: true },
      });
    }, TX_OPTIONS);
    await this.invalidate(orgId);
  }

  async updateDelivery(orgId: string, id: string, input: DeliveryUpdateInput) {
    const doc = await prisma.invoice.findFirst({ where: { id, orgId }, select: { id: true, dispatchDate: true, deliveredDate: true, dispatchMode: true } });
    if (!doc) throw notFound('Document');
    const today = parseISODate(todayISO());
    const data: Prisma.InvoiceUpdateInput = { deliveryStatus: input.delivery_status };
    if (input.dispatch_date !== undefined) data.dispatchDate = dateOrNull(input.dispatch_date);
    else if (['dispatched', 'in_transit', 'delivered'].includes(input.delivery_status) && !doc.dispatchDate) data.dispatchDate = today;
    if (input.delivered_date !== undefined) data.deliveredDate = dateOrNull(input.delivered_date);
    else if (input.delivery_status === 'delivered' && !doc.deliveredDate) data.deliveredDate = today;
    if (input.expected_delivery_date !== undefined) data.expectedDeliveryDate = dateOrNull(input.expected_delivery_date);
    if (input.courier_name !== undefined) data.courierName = input.courier_name;
    if (input.tracking_number !== undefined) data.trackingNumber = input.tracking_number;
    if (doc.dispatchMode === 'none' && (input.courier_name || input.tracking_number)) data.dispatchMode = 'courier';
    await prisma.invoice.update({ where: { id: doc.id }, data });
    await this.invalidate(orgId);
    return this.get(orgId, id);
  }

  private async afterChange(orgId: string, id: string, actor: Actor, isNew = true) {
    await this.invalidate(orgId);
    if (!isNew) return;
    const doc = await prisma.invoice.findUnique({
      where: { id },
      select: { docType: true, approvalStatus: true, invoiceNumber: true, partyName: true, total: true },
    });
    if (doc && docConfig(doc.docType).requiresApproval && doc.approvalStatus === 'pending') {
      await prisma.notification
        .create({
          data: {
            userId: actor.id,
            orgId,
            type: 'approval_pending',
            title: `${docConfig(doc.docType).label} needs approval`,
            message: `${doc.invoiceNumber}${doc.partyName ? ` · ${doc.partyName}` : ''} · ₹${n(doc.total).toLocaleString('en-IN')}`,
            invoiceId: id,
          },
        })
        .catch((e) => console.warn('Approval notification failed:', e.message));
    }
  }

  async invalidate(orgId: string) {
    await Promise.all([
      cacheDel(
        CacheKeys.dashboardStats(orgId),
        CacheKeys.dashboardOverview(orgId),
        CacheKeys.clients(orgId),
        CacheKeys.inventory(orgId),
        CacheKeys.nextInvoiceNumber(orgId),
        CacheKeys.settings(orgId)
      ),
      cacheDelPattern(`dashboard:revenue:${orgId}:*`),
      cacheDelPattern(`${CacheKeys.clients(orgId)}:*`),
    ]);
  }

  /** Everything the PDF renderer needs for one document. */
  async buildPdfData(orgId: string, id: string) {
    const doc = await this.get(orgId, id);
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
    const p = org ? await prisma.profile.findUnique({ where: { id: org.ownerId } }) : null;
    const client = doc.clients;
    const cfg = docConfig(doc.doc_type);
    return {
      ...doc,
      doc_title: cfg.title,
      doc_label: cfg.label,
      is_bill: cfg.isBill,
      side: cfg.side,
      bill_number: doc.bill_number || doc.invoice_number,
      business_name: p?.businessName ?? undefined,
      business_email: p?.businessEmail ?? undefined,
      business_address: p?.businessAddress ?? undefined,
      business_phone: p?.businessPhone ?? undefined,
      gstin: p?.gstin ?? undefined,
      website: p?.website ?? undefined,
      bank_name: p?.bankName ?? undefined,
      bank_account_number: p?.bankAccountNumber ?? undefined,
      bank_ifsc: p?.bankIfsc ?? undefined,
      bank_branch: p?.bankBranch ?? undefined,
      logo_url: p?.logoUrl ?? undefined,
      signature_url: p?.signatureUrl ?? undefined,
      signatory_name: p?.signatoryName ?? undefined,
      show_book_metadata: Boolean(p?.showBookMetadata),
      client_name: doc.party_name ?? client?.name,
      client_email: client?.email ?? undefined,
      client_company: client?.company ?? undefined,
      client_address: doc.billing_address ?? (client && 'address' in client ? client.address : undefined) ?? undefined,
      client_gstin: client && 'gstin' in client ? client.gstin ?? undefined : undefined,
      client_state: client && 'state' in client ? client.state ?? undefined : undefined,
      client_state_code: client && 'state_code' in client ? client.state_code ?? undefined : undefined,
      client_phone: doc.party_phone ?? client?.phone ?? undefined,
    };
  }
}

export const documentService = new DocumentService();
