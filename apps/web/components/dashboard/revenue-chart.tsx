'use client';

import React, { useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevenueChart } from '@/hooks/use-settings';

const formatINR = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-card border border-border rounded-lg shadow-lg p-3">
      <p className="text-xs text-text-2 mb-1">{label}</p>
      <p className="text-sm font-semibold text-text-1">
        ₹{new Intl.NumberFormat('en-IN').format(payload[0].value)}
      </p>
    </div>
  );
}

const periodLabels: Record<string, string> = {
  '7d': '7D',
  '30d': '30D',
  '1y': '1Y',
};

export function RevenueChart() {
  const [period, setPeriod] = useState<'7d' | '30d' | '1y'>('30d');
  const { data, isLoading: loading } = useRevenueChart(period);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
        </CardHeader>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>Revenue Overview</CardTitle>
          <div className="flex gap-1.5">
            {(['7d', '30d', '1y'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                  period === p
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-text-2 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E2F0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#6B6880' }}
              tickLine={false}
              axisLine={false}
              interval={period === '30d' ? 4 : period === '1y' ? 1 : 0}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6B6880' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatINR}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6C63FF"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              dot={{ r: 4, fill: '#6C63FF', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#6C63FF', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
