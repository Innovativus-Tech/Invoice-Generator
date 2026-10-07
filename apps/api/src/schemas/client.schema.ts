import { z } from 'zod';
import { optString } from './common.js';

const optEmail = z.preprocess((v) => (v === '' ? null : v), z.string().email('Invalid email').nullable().optional());
const partyType = z.enum(['customer', 'supplier', 'binder', 'both']);
const creditDays = z.coerce.number().int().min(0, 'Credit days cannot be negative').max(3650);
const amount = z.coerce.number().min(-1e11).max(1e11);

const partyFields = {
  email: optEmail,
  company: optString(200),
  address: optString(1000),
  phone: optString(30),
  notes: optString(4000),
  // GST fields
  gstin: optString(20),
  state: optString(100),
  state_code: optString(10),
  // Party fields
  party_type: partyType.optional(),
  credit_days: creditDays.optional(),
  credit_limit: amount.optional(),
  /** Positive = party owes us (Dr), negative = we owe the party (Cr). */
  opening_balance: amount.optional(),
  pincode: optString(10),
  shipping_address: optString(1000),
  shipping_state: optString(100),
  shipping_pincode: optString(10),
};

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Party name is required').max(200),
  ...partyFields,
});

export const updateClientSchema = z.object({
  name: z.string().trim().min(1, 'Party name is required').max(200).optional(),
  ...partyFields,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
