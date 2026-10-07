'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { useDeletePayment, usePayments, type PaymentFilters } from '@/hooks/use-payments';
import { useDebounce } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYMENT_METHOD_LABEL, docPath } from '@/lib/doc-types';
import { cn, downloadCsv, inr, shortDate } from '@/lib/utils';

type Direction = 'all' | 'in' | 'out';

export default function PaymentsPage() {
  const { can } = usePermissions();
  const [direction, setDirection] = useState<Direction>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'in' | 'out' | null>(null);

  const filters: PaymentFilters = {
    direction: direction === 'all' ? undefined : direction,
    search: debounced || undefined,
    from: range.from || undefined,
    to: range.to || undefined,
    page,
    limit: 25,
  };
  const { data, isLoading } = usePayments(filters);
  const deletePayment = useDeletePayment();
  const rows = data?.payments ?? [];

  const exportCsv = () =>
    downloadCsv('Payments.csv', [
      ['Date', 'No.', 'Type', 'Party', 'Against bill', 'Mode', 'Reference', 'Amount'],
      ...rows.map((p) => [p.payment_date, p.payment_number, p.direction === 'in' ? 'Received' : 'Paid', p.party_name, p.invoice_number, PAYMENT_METHOD_LABEL[p.mode], p.reference, p.amount]),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Money received from customers and paid to suppliers & binders">
        {can('payments', 'create') && (
          <>
            <Button variant="secondary" onClick={() => setDialog('out')} icon={<ArrowUpRight className="h-4 w-4" />}>Make payment</Button>
            <Button onClick={() => setDialog('in')} icon={<Plus className="h-4 w-4" />}>Receive payment</Button>
          </>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-xs text-text-2 uppercase tracking-wide"><ArrowDownLeft className="h-4 w-4 text-green-600" />Received</div>
          <p className="text-2xl font-bold text-green-600 mt-1">{inr(data?.summary.received ?? 0)}</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-xs text-text-2 uppercase tracking-wide"><ArrowUpRight className="h-4 w-4 text-blue-600" />Paid out</div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{inr(data?.summary.paid ?? 0)}</p>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-xs text-text-2 uppercase tracking-wide"><Wallet className="h-4 w-4 text-primary" />Net</div>
          <p className="text-2xl font-bold text-text-1 mt-1">{inr((data?.summary.received ?? 0) - (data?.summary.paid ?? 0))}</p>
        </Card>
      </div>
      <p className="-mt-3 text-xs text-text-2">Cash bills are settled on the bill itself and are not listed here; see Reports for total collections.</p>

      <Card padding={false} className="p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search party, receipt no., cheque / UTR…"
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={range.from} onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(1); }} className="h-10 rounded-md border border-border bg-white px-2 text-sm dark:bg-card" aria-label="From" />
            <input type="date" value={range.to} onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(1); }} className="h-10 rounded-md border border-border bg-white px-2 text-sm dark:bg-card" aria-label="To" />
            <Segmented<Direction>
              ariaLabel="Direction"
              value={direction}
              onChange={(d) => { setDirection(d); setPage(1); }}
              options={[{ value: 'all', label: 'All' }, { value: 'in', label: 'Received' }, { value: 'out', label: 'Paid' }]}
            />
            <Button variant="secondary" size="sm" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>CSV</Button>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">No.</th>
                <th className="px-5 py-3 text-left">Party</th>
                <th className="px-5 py-3 text-left">Against bill</th>
                <th className="px-5 py-3 text-left">Mode</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-text-2">No payments recorded{search || range.from ? ' for these filters' : ' yet'}</td></tr>
              ) : rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface/50 dark:hover:bg-border/10">
                  <td className="px-5 py-3 text-text-2 whitespace-nowrap">{shortDate(p.payment_date)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-text-2">{p.payment_number ?? '—'}</td>
                  <td className="px-5 py-3">
                    {p.client_id ? <Link href={`/clients/${p.client_id}`} className="font-medium text-text-1 hover:text-primary">{p.party_name}</Link> : '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {p.invoice_id && p.invoice_doc_type ? <Link href={docPath(p.invoice_doc_type, p.invoice_id)} className="text-primary hover:underline">{p.invoice_number}</Link> : <span className="text-text-2">On account</span>}
                  </td>
                  <td className="px-5 py-3 text-text-2">
                    {PAYMENT_METHOD_LABEL[p.mode]}{p.reference ? <span className="block text-xs">{p.reference}</span> : null}
                  </td>
                  <td className={cn('px-5 py-3 text-right font-semibold whitespace-nowrap', p.direction === 'in' ? 'text-green-600' : 'text-blue-600')}>
                    {p.direction === 'in' ? '+' : '−'} {inr(p.amount)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {can('payments', 'delete') && (
                      <button
                        onClick={() => { if (confirm('Delete this payment? Bill balances will be recalculated.')) deletePayment.mutate(p.id); }}
                        className="p-1.5 rounded text-text-2 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="Delete payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-sm text-text-2">Page {page} of {data?.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      <PaymentDialog open={!!dialog} onClose={() => setDialog(null)} defaults={{ direction: dialog ?? 'in' }} />
    </div>
  );
}
