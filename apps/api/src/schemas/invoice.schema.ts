import { z } from 'zod';

// Line item schema
export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0, 'Quantity must be positive').default(1),
  unit_price: z.number().min(0, 'Unit price must be positive').default(0),
  amount: z.number().default(0),
  sort_order: z.number().int().default(0),
  // GST fields
  hsn_sac: z.string().optional().nullable().default(''),
  gst_rate: z.number().min(0).max(100).default(18),
  discount_percent: z.number().min(0).max(100).default(0),
});

// Create invoice schema
export const createInvoiceSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'cancelled']).default('draft'),
  issue_date: z.string().min(1, 'Issue date is required'),
  order_id: z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
  order_date: z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
  subtotal: z.number().default(0),
  tax_rate: z.number().min(0).max(100).default(0),
  tax_amount: z.number().default(0),
  discount_amount: z.number().min(0).default(0),
  total: z.number().default(0),
  currency: z.string().default('INR'),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  // GST fields
  supply_type: z.enum(['IGST', 'CGST_SGST']).default('IGST'),
  bill_number: z.string().optional().nullable(),
  place_of_supply: z.string().optional().nullable(),
});

// Update invoice schema (same as create but all fields optional except items)
export const updateInvoiceSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  invoice_number: z.string().min(1).optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'cancelled']).optional(),
  issue_date: z.string().optional(),
  order_id: z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
  order_date: z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
  subtotal: z.number().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  tax_amount: z.number().optional(),
  discount_amount: z.number().min(0).optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  items: z.array(lineItemSchema).optional(),
  // GST fields
  supply_type: z.enum(['IGST', 'CGST_SGST']).optional(),
  bill_number: z.string().optional().nullable(),
  place_of_supply: z.string().optional().nullable(),
});

// Status update schema
export const updateStatusSchema = z.object({
  status: z.enum(['paid', 'cancelled', 'sent', 'viewed']),
});

// Invoice query filters
export const invoiceQuerySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'cancelled']).optional(),
  client_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'total', 'invoice_number']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
