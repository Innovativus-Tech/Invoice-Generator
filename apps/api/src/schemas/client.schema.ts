import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // GST fields
  gstin: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  state_code: z.string().optional().nullable(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').optional(),
  email: z.string().email('Invalid email').optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // GST fields
  gstin: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  state_code: z.string().optional().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
