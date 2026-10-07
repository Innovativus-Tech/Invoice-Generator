import { z } from 'zod';

// HTML forms send '' for untouched optional fields and NaN for empty number inputs.
const emptyToNull = (v: unknown) => (v === '' ? null : v);
const nanToUndefined = (v: unknown) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v);

export const optString = (max = 500) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
export const optDate = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD').nullable().optional()
);
export const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD');
export const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional());
export const money = z.preprocess(nanToUndefined, z.coerce.number().min(0).max(1e11));
export const optMoney = z.preprocess(nanToUndefined, z.coerce.number().min(0).max(1e11).optional());
export const optPercent = z.preprocess(nanToUndefined, z.coerce.number().min(0).max(100).optional());
export const optInt = z.preprocess(
  (v) => (v === '' || v === null ? null : nanToUndefined(v)),
  z.coerce.number().int().min(0).max(1_000_000).nullable().optional()
);

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
};
