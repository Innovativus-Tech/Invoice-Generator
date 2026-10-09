import { z } from 'zod';
import { DOC_TYPES } from '../lib/doc-types.js';
import { money, optDate, optInt, optMoney, optPercent, optString, optUuid, pageQuery, reqDate } from './common.js';

export const docTypeSchema = z.enum(DOC_TYPES);

export const documentStatusSchema = z.enum(['draft', 'sent', 'viewed', 'paid', 'cancelled', 'converted']);

export const documentLineSchema = z
  .object({
    id: z.string().uuid().optional(),
    item_id: optUuid,
    description: z.string().trim().min(1, 'Description is required').max(1000),
    quantity: money.default(1),
    unit_price: money.default(0),
    sort_order: z.coerce.number().int().optional(),
    hsn_sac: optString(50),
    gst_rate: z.preprocess((v) => (v === '' || (typeof v === 'number' && Number.isNaN(v)) ? null : v), z.coerce.number().min(0).max(100).nullable().optional()),
    discount_percent: optPercent,
    isbn: optString(50),
    author: optString(300),
    binding: optString(100),
    damaged_qty: optMoney,
    binding_charge: optMoney,
  })
  .refine((l) => (l.damaged_qty ?? 0) <= (l.quantity ?? 0), {
    message: 'Damaged quantity cannot exceed quantity',
    path: ['damaged_qty'],
  });

const documentFields = {
  invoice_number: optString(60),
  status: documentStatusSchema.optional(),
  issue_date: reqDate,
  client_id: optUuid,
  payment_mode: z.enum(['cash', 'credit']).optional(),
  party_name: optString(200),
  party_phone: optString(30),
  credit_days: optInt,
  due_date: optDate,
  billing_address: optString(1000),
  shipping_name: optString(200),
  shipping_address: optString(1000),
  order_id: optString(100),
  order_date: optDate,
  bill_number: optString(100),
  place_of_supply: optString(100),
  supply_type: z.enum(['IGST', 'CGST_SGST']).optional(),
  currency: optString(10),
  notes: optString(4000),
  terms: optString(4000),
  party_ref_number: optString(100),
  party_ref_date: optDate,
  extra_discount_type: z.enum(['percent', 'amount']).optional(),
  extra_discount_value: optMoney,
  postage_charge: optMoney,
  other_charges: optMoney,
  other_charges_label: optString(100),
  apply_round_off: z.boolean().optional(),
  source_doc_id: optUuid,
  affects_stock: z.boolean().optional(),
  valid_until: optDate,
  reason: optString(1000),
  dispatch_mode: z.enum(['none', 'courier', 'transport', 'hand']).optional(),
  delivery_status: z.enum(['pending', 'dispatched', 'in_transit', 'delivered', 'returned']).optional(),
  courier_name: optString(100),
  tracking_number: optString(100),
  dispatch_date: optDate,
  expected_delivery_date: optDate,
  delivered_date: optDate,
  transport_name: optString(150),
  lr_number: optString(100),
  vehicle_number: optString(50),
  cartons: optInt,
  freight_type: z.preprocess((v) => (v === '' ? null : v), z.enum(['paid', 'to_pay']).nullable().optional()),
  delivery_type: z.preprocess((v) => (v === '' ? null : v), z.enum(['door', 'godown']).nullable().optional()),
  transport_details: optString(1000),
};

export const createDocumentSchema = z.object({
  doc_type: docTypeSchema,
  ...documentFields,
  // Advance paid at the time of a credit bill (recorded as a payment against it).
  paid_now_amount: optMoney,
  paid_now_mode: z.enum(['cash', 'upi', 'bank', 'cheque', 'card', 'other']).optional(),
  paid_now_reference: optString(100),
  items: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500),
});

export const updateDocumentSchema = z.object({
  ...documentFields,
  issue_date: reqDate.optional(),
  items: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500).optional(),
});

export const documentQuerySchema = z.object({
  type: docTypeSchema.optional(),
  side: z.enum(['sales', 'purchase']).optional(),
  status: documentStatusSchema.optional(),
  client_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  delivery_status: z.enum(['pending', 'dispatched', 'in_transit', 'delivered', 'returned']).optional(),
  payment_mode: z.enum(['cash', 'credit']).optional(),
  unpaid: z.enum(['true', 'false']).optional(),
  sort: z.enum(['issue_date', 'created_at', 'total', 'invoice_number', 'due_date']).default('issue_date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...pageQuery,
});

export const statusUpdateSchema = z.object({ status: documentStatusSchema });

export const rejectSchema = z.object({ reason: z.string().trim().min(1, 'Reason is required').max(1000) });

export const deliveryUpdateSchema = z.object({
  delivery_status: z.enum(['pending', 'dispatched', 'in_transit', 'delivered', 'returned']),
  dispatch_date: optDate,
  expected_delivery_date: optDate,
  delivered_date: optDate,
  courier_name: optString(100),
  tracking_number: optString(100),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentQuery = z.infer<typeof documentQuerySchema>;
export type DocumentLineInput = z.infer<typeof documentLineSchema>;
export type DeliveryUpdateInput = z.infer<typeof deliveryUpdateSchema>;
