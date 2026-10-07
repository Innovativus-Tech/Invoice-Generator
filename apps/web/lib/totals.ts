// Document totals for the form and live preview. The API recomputes and stores
// the authoritative values. Keep in sync with apps/api/src/lib/totals.ts.

export interface TotalsLine {
  quantity: number;
  unit_price: number;
  discount_percent?: number | null;
  gst_rate?: number | null;
}

export interface TotalsInput {
  items: TotalsLine[];
  extra_discount_type?: 'percent' | 'amount' | null;
  extra_discount_value?: number | null;
  postage_charge?: number | null;
  other_charges?: number | null;
  apply_round_off?: boolean | null;
}

export interface Totals {
  lineAmounts: number[];
  subtotal: number;
  extraDiscount: number;
  taxable: number;
  tax: number;
  charges: number;
  roundOff: number;
  total: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const gstRateOf = (rate: number | null | undefined) => (rate == null || Number.isNaN(rate) ? 18 : num(rate));

export function lineAmount(line: TotalsLine): number {
  const disc = Math.min(Math.max(num(line.discount_percent), 0), 100);
  return round2(num(line.quantity) * num(line.unit_price) * (1 - disc / 100));
}

export function computeTotals(input: TotalsInput): Totals {
  const lineAmounts = input.items.map(lineAmount);
  const subtotal = round2(lineAmounts.reduce((s, a) => s + a, 0));

  const discountValue = Math.max(num(input.extra_discount_value), 0);
  const rawDiscount = input.extra_discount_type === 'amount' ? discountValue : (subtotal * Math.min(discountValue, 100)) / 100;
  const extraDiscount = round2(Math.min(rawDiscount, subtotal));

  const factor = subtotal > 0 ? (subtotal - extraDiscount) / subtotal : 0;
  const tax = round2(
    input.items.reduce((s, line, i) => s + lineAmounts[i] * factor * (gstRateOf(line.gst_rate) / 100), 0)
  );

  const taxable = round2(subtotal - extraDiscount);
  const charges = round2(Math.max(num(input.postage_charge), 0) + Math.max(num(input.other_charges), 0));
  const gross = taxable + tax + charges;
  const roundOff = input.apply_round_off ? round2(Math.round(gross) - gross) : 0;
  const total = round2(gross + roundOff);

  return { lineAmounts, subtotal, extraDiscount, taxable, tax, charges, roundOff, total };
}
