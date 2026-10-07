import { z } from 'zod';
import { optString, optUuid, pageQuery, reqDate } from './common.js';

export const paymentModeSchema = z.enum(['cash', 'upi', 'bank', 'cheque', 'card', 'other']);

export const createPaymentSchema = z
  .object({
    client_id: optUuid,
    invoice_id: optUuid,
    direction: z.enum(['in', 'out']),
    amount: z.coerce.number().positive('Amount must be greater than zero').max(1e11),
    payment_date: reqDate,
    mode: paymentModeSchema.default('cash'),
    reference: optString(100),
    notes: optString(1000),
  })
  .refine((p) => p.client_id || p.invoice_id, { message: 'Choose a party or a bill', path: ['client_id'] });

export const updatePaymentSchema = z.object({
  client_id: optUuid,
  invoice_id: optUuid,
  direction: z.enum(['in', 'out']).optional(),
  amount: z.coerce.number().positive().max(1e11).optional(),
  payment_date: reqDate.optional(),
  mode: paymentModeSchema.optional(),
  reference: optString(100),
  notes: optString(1000),
});

export const paymentQuerySchema = z.object({
  direction: z.enum(['in', 'out']).optional(),
  client_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  mode: paymentModeSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  ...pageQuery,
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
