'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronRight, Download, IndianRupee, Phone, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { DueBadge } from '@/components/documents/doc-badges';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { useOutstanding } from '@/hooks/use-reports';
import { usePermissions } from '@/hooks/use-permissions';
import { docPath } from '@/lib/doc-types';
import { cn, downloadCsv, inr, shortDate } from '@/lib/utils';
import type { AgingBuckets, PaymentFormValues } from '@/types';

const BUCKETS: { key: keyof AgingBuckets; label: string; tone: string }[] = [
  { key: 'not_due', label: 'Not yet due', tone: 'text-text-1' },
  { key: 'd1_30', label: '1–30 days late', tone: 'text-amber-600' },
  { key: 'd31_60', label: '31–60 days late', tone: 'text-orange-600' },
  { key: 'd61_90', label: '61–90 days late', tone: 'text-red-600' },
  { key: 'd90_plus', label: '90+ days late', tone: 'text-red-700' },
];

type Side = 'receivable' | 'payable';

export default function OutstandingPage() {
  const { can } = usePermissions();
  const [side, setSide] = useState<Side>('receivable');
  const [search, setSearch] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payment, setPayment] = useState<Partial<PaymentFormValues> | null>(null);
  const { data, isLoading } = useOutstanding(side);

  const parties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.parties ?? []).filter((p) =>
      (!onlyOverdue || p.overdue_amount > 0) && (!q || p.name.toLowerCase().includes(q) || p.phone?.includes(q)));
  }, [data, search, onlyOverdue]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const exportCsv = () =>
    downloadCsv(`Outstanding-${side}.csv`, [
      ['Party', 'Phone', 'Credit days', 'Bill', 'Bill date', 'Due date', 'Days overdue', 'Outstanding'],
      ...parties.flatMap((p) => p.items.map((i) => [p.name, p.phone, p.credit_days, i.number ?? i.description, i.date, i.due_date, i.days_overdue, i.outstanding])),
    ]);

  const totals = data?.totals;
  const receivable = side === 'receivable';

  return (
    <div className="space-y-6">
      <PageHeader title="Outstanding" description="Who owes you, who you owe, and how many days each bill is late">
        <Button variant="secondary" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>CSV</Button>
      </PageHeader>

      <Segmented<Side>
        ariaLabel="Side"
        size="lg"
        value={side}
        onChange={(s) => { setSide(s); setExpanded(new Set()); }}
        options={[{ value: 'receivable', label: 'To collect (customers)' }, { value: 'payable', label: 'To pay (suppliers & binders)' }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="!p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-text-2 uppercase tracking-wide">Total {receivable ? 'to collect' : 'to pay'}</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{totals ? inr(totals.outstanding) : '—'}</p>
          <p className="text-xs text-text-2 mt-1">{data?.party_count ?? 0} parties · overdue {inr(totals?.overdue_amount ?? 0)}</p>
        </Card>
        {BUCKETS.map((b) => (
          <Card key={b.key} className="!p-4">
            <p className="text-xs text-text-2 uppercase tracking-wide">{b.label}</p>
            <p className={cn('text-xl font-bold mt-1', b.tone)}>{totals ? inr(totals.buckets[b.key]) : '—'}</p>
          </Card>
        ))}
      </div>

      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search party or phone…"
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-1 cursor-pointer">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="h-4 w-4 rounded border-border text-primary" />
            Only overdue
          </label>
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left">Party</th>
                <th className="px-4 py-3 text-center">Credit days</th>
                <th className="px-4 py-3 text-left">Oldest due</th>
                <th className="px-4 py-3 text-left">Days late</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>)
              ) : parties.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-text-2">{receivable ? 'Nothing to collect — everyone has paid.' : 'Nothing to pay.'}</td></tr>
              ) : parties.map((p) => {
                const key = p.client_id ?? 'walk-in';
                const open = expanded.has(key);
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-surface/50 dark:hover:bg-border/10 cursor-pointer" onClick={() => toggle(key)}>
                      <td className="px-4 py-3 text-text-2">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="px-4 py-3">
                        {p.client_id ? (
                          <Link href={`/clients/${p.client_id}?tab=ledger`} onClick={(e) => e.stopPropagation()} className="font-medium text-text-1 hover:text-primary">{p.name}</Link>
                        ) : <span className="font-medium text-text-1">{p.name}</span>}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-text-2 hover:text-primary">
                            <Phone className="h-3 w-3" />{p.phone}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-text-2">{p.credit_days ? `${p.credit_days} days` : '—'}</td>
                      <td className="px-4 py-3 text-text-2 whitespace-nowrap">{shortDate(p.oldest_due_date)}</td>
                      <td className="px-4 py-3">
                        {p.max_days_overdue > 0 ? (
                          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', p.max_days_overdue > 60 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
                            {p.max_days_overdue > 60 && <AlertTriangle className="h-3 w-3" />}
                            {p.max_days_overdue} days
                          </span>
                        ) : p.next_due_date ? (
                          <span className="text-xs text-text-2">Due {shortDate(p.next_due_date)}</span>
                        ) : <span className="text-xs text-text-2">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600 whitespace-nowrap">{p.overdue_amount > 0 ? inr(p.overdue_amount) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-text-1 whitespace-nowrap">{inr(p.outstanding)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {p.client_id && can('payments', 'create') && (
                          <Button size="sm" variant="ghost" aria-label={receivable ? 'Receive payment' : 'Make payment'}
                            onClick={() => setPayment({ direction: receivable ? 'in' : 'out', client_id: p.client_id!, amount: p.outstanding })}
                            icon={<IndianRupee className="h-4 w-4" />} />
                        )}
                      </td>
                    </tr>
                    {open && p.items.map((i) => (
                      <tr key={i.key} className="bg-surface/40 dark:bg-border/5 text-xs">
                        <td />
                        <td className="px-4 py-2 pl-8">
                          {i.doc_id && i.doc_type ? (
                            <Link href={docPath(i.doc_type, i.doc_id)} className="font-mono text-primary hover:underline">{i.number}</Link>
                          ) : <span className="text-text-1">{i.description}</span>}
                          <span className="ml-2 text-text-2">{shortDate(i.date)}</span>
                        </td>
                        <td />
                        <td className="px-4 py-2 text-text-2">{shortDate(i.due_date)}</td>
                        <td className="px-4 py-2"><DueBadge daysOverdue={i.days_overdue} daysToDue={i.days_to_due} /></td>
                        <td className="px-4 py-2 text-right text-text-2">of {inr(i.amount)}</td>
                        <td className="px-4 py-2 text-right font-medium text-text-1">{inr(i.outstanding)}</td>
                        <td />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PaymentDialog open={!!payment} onClose={() => setPayment(null)} defaults={payment ?? undefined} lockParty />
    </div>
  );
}
