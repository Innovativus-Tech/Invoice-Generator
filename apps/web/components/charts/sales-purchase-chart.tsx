'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr, inrCompact } from '@/lib/utils';

export interface SalesPurchasePoint {
  label: string;
  sales: number;
  purchases: number;
}

const SERIES = [
  { key: 'sales', label: 'Sales', color: 'var(--series-1)' },
  { key: 'purchases', label: 'Purchases', color: 'var(--series-2)' },
] as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg dark:bg-card">
      <p className="mb-1 text-xs text-text-2">{label}</p>
      {SERIES.map((s) => {
        const point = payload.find((p) => p.dataKey === s.key);
        if (!point) return null;
        return (
          <p key={s.key} className="flex items-center gap-2 text-sm text-text-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-text-2">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold">{inr(point.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Sales vs purchases by period: grouped columns, one axis, legend + hover tooltip. */
export function SalesPurchaseChart({ data, height = 260 }: { data: SalesPurchasePoint[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-text-2" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ height }} role="img" aria-label="Sales and purchases by period">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} tickFormatter={inrCompact} width={56} tickCount={6} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.35 }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
