import { addDaysISO, todayISO } from '@/lib/utils';
import { docUi } from '@/lib/doc-types';
import type { BillingDocument, Client, DocType, DocumentFormValues, DocumentItem } from '@/types';

export const blankLine = (): DocumentItem => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  amount: 0,
  sort_order: 0,
  hsn_sac: '',
  gst_rate: 18,
  discount_percent: 0,
  item_id: null,
  binding: '',
  damaged_qty: 0,
  binding_charge: 0,
});

export function emptyDocument(type: DocType): DocumentFormValues {
  const today = todayISO();
  return {
    invoice_number: '',
    status: 'draft',
    issue_date: today,
    client_id: null,
    payment_mode: 'credit',
    party_name: '',
    party_phone: '',
    credit_days: 0,
    due_date: today,
    billing_address: '',
    shipping_name: '',
    shipping_address: '',
    order_id: '',
    order_date: '',
    bill_number: '',
    place_of_supply: '',
    supply_type: 'IGST',
    notes: '',
    terms: '',
    party_ref_number: '',
    party_ref_date: '',
    extra_discount_type: 'percent',
    extra_discount_value: 0,
    postage_charge: 0,
    other_charges: 0,
    other_charges_label: '',
    apply_round_off: true,
    source_doc_id: null,
    affects_stock: true,
    valid_until: type === 'estimate' ? addDaysISO(today, 15) : '',
    reason: '',
    dispatch_mode: 'none',
    delivery_status: 'pending',
    courier_name: '',
    tracking_number: '',
    dispatch_date: '',
    expected_delivery_date: '',
    delivered_date: '',
    transport_name: '',
    lr_number: '',
    vehicle_number: '',
    cartons: null,
    freight_type: '',
    delivery_type: '',
    transport_details: '',
    paid_now_amount: 0,
    paid_now_mode: 'cash',
    paid_now_reference: '',
    items: [blankLine()],
  };
}

const compose = (...parts: (string | null | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(', ');

/** Party-derived fields to fill when a party is picked on the form. */
export function partyFields(type: DocType, party: Client, issueDate: string): Partial<DocumentFormValues> {
  const billing = compose(party.address, party.pincode);
  const shipping = compose(party.shipping_address, party.shipping_state, party.shipping_pincode) || billing;
  const creditDays = docUi(type).isBill ? party.credit_days ?? 0 : 0;
  return {
    client_id: party.id,
    party_name: party.name,
    party_phone: party.phone ?? '',
    billing_address: billing,
    shipping_name: party.name,
    shipping_address: shipping,
    place_of_supply: party.state ?? '',
    credit_days: creditDays,
    due_date: addDaysISO(issueDate, creditDays),
  };
}

const s = (v: string | null | undefined) => v ?? '';

/** Existing document → editable form values. */
export function documentToFormValues(doc: BillingDocument): DocumentFormValues {
  return {
    invoice_number: doc.invoice_number,
    status: doc.status,
    issue_date: doc.issue_date,
    client_id: doc.client_id,
    payment_mode: doc.payment_mode,
    party_name: s(doc.party_name),
    party_phone: s(doc.party_phone),
    credit_days: doc.credit_days,
    due_date: s(doc.due_date),
    billing_address: s(doc.billing_address),
    shipping_name: s(doc.shipping_name),
    shipping_address: s(doc.shipping_address),
    order_id: s(doc.order_id),
    order_date: s(doc.order_date),
    bill_number: s(doc.bill_number),
    place_of_supply: s(doc.place_of_supply),
    supply_type: doc.supply_type ?? 'IGST',
    notes: s(doc.notes),
    terms: s(doc.terms),
    party_ref_number: s(doc.party_ref_number),
    party_ref_date: s(doc.party_ref_date),
    extra_discount_type: doc.extra_discount_type,
    extra_discount_value: doc.extra_discount_value,
    postage_charge: doc.postage_charge,
    other_charges: doc.other_charges,
    other_charges_label: s(doc.other_charges_label),
    apply_round_off: doc.apply_round_off,
    source_doc_id: doc.source_doc_id,
    affects_stock: doc.affects_stock,
    valid_until: s(doc.valid_until),
    reason: s(doc.reason),
    dispatch_mode: doc.dispatch_mode,
    delivery_status: doc.delivery_status,
    courier_name: s(doc.courier_name),
    tracking_number: s(doc.tracking_number),
    dispatch_date: s(doc.dispatch_date),
    expected_delivery_date: s(doc.expected_delivery_date),
    delivered_date: s(doc.delivered_date),
    transport_name: s(doc.transport_name),
    lr_number: s(doc.lr_number),
    vehicle_number: s(doc.vehicle_number),
    cartons: doc.cartons,
    freight_type: doc.freight_type ?? '',
    delivery_type: doc.delivery_type ?? '',
    transport_details: s(doc.transport_details),
    items: (doc.items ?? []).map((i, idx) => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      amount: Number(i.amount),
      sort_order: idx,
      hsn_sac: i.hsn_sac ?? '',
      gst_rate: Number(i.gst_rate ?? 18),
      discount_percent: Number(i.discount_percent ?? 0),
      binding: i.binding ?? '',
      damaged_qty: Number(i.damaged_qty ?? 0),
      binding_charge: Number(i.binding_charge ?? 0),
      isbn: i.isbn ?? '',
      author: i.author ?? '',
    })),
  };
}

/**
 * Pre-fills a new document from the one it is converted from
 * (estimate → invoice/challan, challan → invoice, invoice → return/credit note,
 * binding order → purchase bill, purchase bill → return/debit note).
 */
export function convertDocument(source: BillingDocument, target: DocType): DocumentFormValues {
  const base = documentToFormValues(source);
  const fresh = emptyDocument(target);
  const today = todayISO();
  const isReturn = target === 'sales_return' || target === 'purchase_return';
  const isNote = target === 'credit_note' || target === 'debit_note';

  let items: DocumentItem[] = base.items.map((i) => ({ ...i, damaged_qty: 0 }));
  if (target === 'purchase_return') {
    // Usually the damaged copies go back to the binder.
    const damaged = base.items.filter((i) => (i.damaged_qty ?? 0) > 0);
    if (damaged.length) items = damaged.map((i) => ({ ...i, quantity: i.damaged_qty!, damaged_qty: i.damaged_qty! }));
  }
  if (isNote) {
    items = [{ ...blankLine(), description: `${target === 'credit_note' ? 'Credit' : 'Debit'} against ${source.invoice_number}` }];
  }

  const creditDays = docUi(target).isBill ? source.clients?.credit_days ?? source.credit_days ?? 0 : 0;
  return {
    ...fresh,
    client_id: base.client_id,
    payment_mode: docUi(target).isBill ? (base.client_id ? 'credit' : 'cash') : 'credit',
    party_name: base.party_name,
    party_phone: base.party_phone,
    billing_address: base.billing_address,
    shipping_name: base.shipping_name,
    shipping_address: base.shipping_address,
    place_of_supply: base.place_of_supply,
    supply_type: base.supply_type,
    credit_days: creditDays,
    due_date: addDaysISO(today, creditDays),
    order_id: base.order_id,
    order_date: base.order_date,
    notes: isReturn || isNote ? '' : base.notes,
    extra_discount_type: base.extra_discount_type,
    // Returns keep the bill's percentage discount so the credited value matches what was charged.
    extra_discount_value: isNote || (isReturn && base.extra_discount_type === 'amount') ? 0 : base.extra_discount_value,
    postage_charge: isReturn || isNote ? 0 : base.postage_charge,
    other_charges: isReturn || isNote ? 0 : base.other_charges,
    other_charges_label: isReturn || isNote ? '' : base.other_charges_label,
    apply_round_off: base.apply_round_off,
    dispatch_mode: isReturn || isNote ? 'none' : base.dispatch_mode,
    courier_name: isReturn || isNote ? '' : base.courier_name,
    tracking_number: isReturn || isNote ? '' : base.tracking_number,
    transport_name: isReturn || isNote ? '' : base.transport_name,
    lr_number: isReturn || isNote ? '' : base.lr_number,
    cartons: isReturn || isNote ? null : base.cartons,
    freight_type: isReturn || isNote ? '' : base.freight_type,
    delivery_type: isReturn || isNote ? '' : base.delivery_type,
    dispatch_date: isReturn || isNote ? '' : base.dispatch_date,
    source_doc_id: source.id,
    items,
  };
}
