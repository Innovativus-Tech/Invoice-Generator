'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { docUi } from '@/lib/doc-types';
import { computeTotals, gstRateOf } from '@/lib/totals';
import { formatIndianCurrency, shortDate } from '@/lib/utils';
import type { DocType, DocumentFormValues } from '@/types';

const inputCls =
  'w-full h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card';

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${muted ? 'text-text-2' : ''}`}>
      <span className={strong ? 'font-semibold text-text-1' : 'text-text-2'}>{label}</span>
      <span className={strong ? 'text-xl font-bold text-primary' : 'font-medium text-text-1'}>{value}</span>
    </div>
  );
}

export function ChargesCard({ type }: { type: DocType }) {
  const ui = docUi(type);
  const { register, setValue } = useFormContext<DocumentFormValues>();
  const v = useWatch<DocumentFormValues>() as DocumentFormValues;
  const items = v.items ?? [];

  const t = computeTotals({
    items: items.map((i) => ({ quantity: i?.quantity ?? 0, unit_price: i?.unit_price ?? 0, discount_percent: i?.discount_percent, gst_rate: i?.gst_rate, binding_charge: i?.binding_charge })),
    extra_discount_type: v.extra_discount_type,
    extra_discount_value: v.extra_discount_value,
    postage_charge: v.postage_charge,
    other_charges: v.other_charges,
    apply_round_off: v.apply_round_off,
  });
  const rates = Array.from(new Set(items.map((i) => gstRateOf(i?.gst_rate))));
  const rateLabel = rates.length === 1 ? `${rates[0]}%` : 'mixed';
  const half = rates.length === 1 ? `${rates[0] / 2}%` : 'mixed';
  const fmt = formatIndianCurrency;
  const isCreditBill = ui.isBill && v.payment_mode === 'credit';
  const bindingTotal = ui.side === 'purchase'
    ? items.reduce((sum, i) => sum + (i?.quantity || 0) * (i?.binding_charge || 0) * (1 - (i?.discount_percent || 0) / 100), 0)
    : 0;
  const paidNow = Math.min(Number(v.paid_now_amount) || 0, t.total);

  return (
    <Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Discount & charges</h3>
          <div>
            <label className="block text-sm font-medium text-text-1 mb-1.5">Extra discount (on the whole bill)</label>
            <div className="flex gap-2">
              <Segmented<'percent' | 'amount'>
                size="sm"
                ariaLabel="Discount type"
                value={v.extra_discount_type ?? 'percent'}
                onChange={(val) => setValue('extra_discount_type', val, { shouldDirty: true })}
                options={[{ value: 'percent', label: '%' }, { value: 'amount', label: '₹' }]}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                {...register('extra_discount_value', { valueAsNumber: true })}
                className={inputCls}
              />
            </div>
            <p className="mt-1 text-xs text-text-2">Applied after line discounts; GST is charged on the reduced value.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Postage / delivery (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="0" {...register('postage_charge', { valueAsNumber: true })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Other charges (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="0" {...register('other_charges', { valueAsNumber: true })} className={inputCls} />
            </div>
          </div>
          {(v.other_charges ?? 0) > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Other charges label</label>
              <input placeholder="e.g. Packing, Loading" {...register('other_charges_label')} className={inputCls} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-text-1 cursor-pointer">
            <input type="checkbox" {...register('apply_round_off')} className="h-4 w-4 rounded border-border text-primary" />
            Round off total to the nearest rupee
          </label>
        </div>

        <div className="space-y-2 lg:border-l lg:border-border lg:pl-6">
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-2">Totals</h3>
          <Row label="Subtotal" value={fmt(t.subtotal)} />
          {bindingTotal > 0 && <Row label="↳ includes binding charges" value={fmt(bindingTotal)} muted />}
          {t.extraDiscount > 0 && (
            <>
              <Row label={`Extra discount${v.extra_discount_type === 'percent' ? ` (${v.extra_discount_value}%)` : ''}`} value={`− ${fmt(t.extraDiscount)}`} />
              <Row label="Taxable value" value={fmt(t.taxable)} />
            </>
          )}
          {(t.tax > 0 || type === 'sales_invoice') && (
            v.supply_type === 'CGST_SGST' ? (
              <>
                <Row label={`CGST (${half})`} value={fmt(t.tax / 2)} />
                <Row label={`SGST (${half})`} value={fmt(t.tax / 2)} />
              </>
            ) : (
              <Row label={`IGST (${rateLabel})`} value={fmt(t.tax)} />
            )
          )}
          {(v.postage_charge ?? 0) > 0 && <Row label="Postage / delivery" value={fmt(v.postage_charge)} />}
          {(v.other_charges ?? 0) > 0 && <Row label={v.other_charges_label || 'Other charges'} value={fmt(v.other_charges)} />}
          {t.roundOff !== 0 && <Row label="Round off" value={`${t.roundOff > 0 ? '+' : '−'} ${fmt(Math.abs(t.roundOff))}`} muted />}
          <div className="pt-3 mt-1 border-t-2 border-primary">
            <Row label={type === 'estimate' ? 'Approximate total' : 'Total'} value={fmt(t.total)} strong />
          </div>
          {isCreditBill && paidNow > 0 && (
            <>
              <Row label="Paid now" value={`− ${fmt(paidNow)}`} />
              <Row label="Balance on credit" value={fmt(t.total - paidNow)} />
            </>
          )}
          {isCreditBill && v.due_date && (
            <p className="text-xs text-text-2 text-right">Due on {shortDate(v.due_date)}{v.credit_days ? ` (${v.credit_days} days credit)` : ''}</p>
          )}
          {ui.isBill && v.payment_mode === 'cash' && <p className="text-xs text-green-600 text-right">Cash — settled on saving</p>}
        </div>
      </div>
    </Card>
  );
}
