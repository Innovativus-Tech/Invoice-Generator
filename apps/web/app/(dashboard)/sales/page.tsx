'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, TrendingDown, FileText, DollarSign, BarChart3, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesSummary } from '@/hooks/use-sales';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import type { Invoice } from '@/types';

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatINR = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;

const formatINRCompact = (value: number) =>
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

export default function SalesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const router = useRouter();

  const { data, isLoading } = useSalesSummary(month, year);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get(`/sales/export-pdf?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales-Report-${monthLabels[month - 1]}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Sales report downloaded');
    } catch {
      toast.error('Failed to export sales report');
    } finally {
      setExporting(false);
    }
  };

  // Calculate growth
  const growth = (() => {
    if (!data?.monthly_breakdown || data.monthly_breakdown.length < 2) return 0;
    const current = data.monthly_breakdown[data.monthly_breakdown.length - 1]?.amount || 0;
    const previous = data.monthly_breakdown[data.monthly_breakdown.length - 2]?.amount || 0;
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  })();

  const paginatedInvoices = data?.invoices?.slice((page - 1) * 10, page * 10) || [];
  const totalPages = Math.ceil((data?.invoices?.length || 0) / 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Sales" description="Track your revenue and paid invoices" />
        <Button onClick={handleExportPdf} loading={exporting} icon={<Download className="h-4 w-4" />}>
          Export PDF
        </Button>
      </div>

      {/* Month/Year Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-card border border-border rounded-xl p-1 overflow-x-auto">
          {monthLabels.map((m, i) => (
            <button
              key={m}
              onClick={() => { setMonth(i + 1); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                month === i + 1
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-2 hover:text-text-1 hover:bg-surface dark:hover:bg-border/30'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-1.5 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface border border-border"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm font-semibold text-text-1 min-w-[60px] text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-1.5 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface border border-border"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Total Revenue</span>
              <div className="h-8 w-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{formatINR(data?.total_revenue || 0)}</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Paid Invoices</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{data?.invoice_count || 0}</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Average Invoice</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{formatINR(data?.average_invoice_value || 0)}</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">vs Last Month</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                growth >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                {growth >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <p className={`text-2xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growth >= 0 ? '+' : ''}{growth}%
            </p>
          </Card>
        </motion.div>
      )}

      {/* Revenue Chart */}
      <Card>
        <div className="p-5 pb-0">
          <h3 className="text-base font-semibold text-text-1">Revenue Trend (Last 12 Months)</h3>
        </div>
        <div className="h-64 w-full p-4">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthly_breakdown || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B6880' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6880' }} tickLine={false} axisLine={false} tickFormatter={formatINRCompact} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#6C63FF" strokeWidth={2.5} fill="url(#salesGradient)"
                  dot={{ r: 4, fill: '#6C63FF', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#6C63FF', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top Clients */}
      <Card>
        <div className="p-5 pb-3">
          <h3 className="text-base font-semibold text-text-1">Top Clients This Month</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-border">
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5 w-12">Rank</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Client</th>
                <th className="text-center text-xs font-medium text-text-2 uppercase py-3 px-5">Invoices</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Revenue</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : data?.top_clients && data.top_clients.length > 0 ? (
                data.top_clients.map((c, i) => {
                  const pct = data.total_revenue > 0 ? Math.round((c.total / data.total_revenue) * 100) : 0;
                  const badgeColors = ['bg-yellow-100 text-yellow-700', 'bg-gray-100 text-gray-600', 'bg-orange-100 text-orange-700'];
                  return (
                    <tr key={i} className="border-b border-border hover:bg-surface dark:hover:bg-border/20 transition-colors cursor-pointer"
                      onClick={() => c.client_id && router.push(`/clients/${c.client_id}`)}
                    >
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${badgeColors[i] || 'bg-gray-50 text-gray-500'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-sm font-medium text-text-1">{c.client_name}</td>
                      <td className="py-3 px-5 text-sm text-text-2 text-center">{c.invoice_count}</td>
                      <td className="py-3 px-5 text-sm font-semibold text-text-1 text-right">{formatINR(c.total)}</td>
                      <td className="py-3 px-5 text-sm text-text-2 text-right">{pct}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-text-2">No client data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Paid Invoices Table */}
      <Card>
        <div className="p-5 pb-3">
          <h3 className="text-base font-semibold text-text-1">Paid Invoices — {monthLabels[month - 1]} {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-border">
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Invoice No</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Client</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Issue Date</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Paid Amount</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((inv: Invoice) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-surface dark:hover:bg-border/20 transition-colors">
                    <td className="py-3 px-5 text-sm font-mono font-medium text-primary">{inv.invoice_number}</td>
                    <td className="py-3 px-5 text-sm text-text-1">{inv.clients?.name || 'N/A'}</td>
                    <td className="py-3 px-5 text-sm text-text-2">{new Date(inv.issue_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-5 text-sm font-semibold text-text-1 text-right">{formatINR(Number(inv.total))}</td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-text-2">No paid invoices for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-text-2">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface disabled:opacity-40"
              >Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
