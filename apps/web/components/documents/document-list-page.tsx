'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightLeft, CheckCircle, ChevronLeft, ChevronRight, Download, Edit, Eye, FileText, MoreHorizontal, Plus, Search, Trash2, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, Select } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { DeliveryBadge, DocStatus, DueBadge } from './doc-badges';
import { useDeleteDocument, useDocuments, useDownloadDocumentPdf, useUpdateDocumentStatus } from '@/hooks/use-documents';
import { useDebounce } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';
import { docPath, docUi, newDocPath } from '@/lib/doc-types';
import { cn, daysUntil, inr, shortDate } from '@/lib/utils';
import type { ApprovalStatus, BillingDocument, DocType, DocumentFilters, InvoiceStatus } from '@/types';

type Action = { label: string; icon?: React.ReactNode; onClick?: () => void; danger?: boolean; separator?: boolean };

export function DocumentListPage({ type }: { type: DocType }) {
  const ui = docUi(type);
  const router = useRouter();
  const params = useSearchParams();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [filters, setFilters] = useState<DocumentFilters>(() => ({
    type,
    page: 1,
    limit: 25,
    sort: 'issue_date',
    order: 'desc',
    ...(params.get('approval') && { approval_status: params.get('approval') as ApprovalStatus }),
    ...(params.get('unpaid') && { unpaid: 'true' as const }),
  }));

  useEffect(() => setFilters((f) => ({ ...f, page: 1 })), [debounced]);

  const { data, isLoading, isFetching } = useDocuments({ ...filters, search: debounced || undefined });
  const deleteDoc = useDeleteDocument();
  const setStatus = useUpdateDocumentStatus();
  const download = useDownloadDocumentPdf();

  const docs = data?.documents ?? [];
  const canCreate = can(ui.resource, 'create');

  const actions = (d: BillingDocument): Action[] => {
    const list: (Action | null)[] = [
      { label: 'View', icon: <Eye className="h-4 w-4" />, onClick: () => router.push(docPath(type, d.id)) },
      can(ui.resource, 'update') && d.status !== 'cancelled' ? { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: () => router.push(docPath(type, d.id, 'edit')) } : null,
      { label: 'Download PDF', icon: <Download className="h-4 w-4" />, onClick: () => download.mutate({ id: d.id, fileName: `${ui.label}-${d.invoice_number}` }) },
      ...ui.convertsTo
        .filter((t) => can(docUi(t).resource, 'create') && d.status !== 'cancelled' && (d.status !== 'converted' || !['estimate', 'delivery_challan', 'binding_order'].includes(type)))
        .map((t) => ({ label: `Make ${docUi(t).label}`, icon: <ArrowRightLeft className="h-4 w-4" />, onClick: () => router.push(newDocPath(t, { from: d.id })) })),
      ui.isBill && d.payment_status !== 'paid' && d.status !== 'cancelled' && can(ui.resource, 'update')
        ? { label: 'Mark as paid', icon: <CheckCircle className="h-4 w-4" />, onClick: () => setStatus.mutate({ id: d.id, status: 'paid' }) }
        : null,
      can(ui.resource, 'update') && d.status !== 'cancelled' && d.status !== 'converted'
        ? { label: 'Cancel', icon: <XCircle className="h-4 w-4" />, onClick: () => { if (confirm(`Cancel ${d.invoice_number}? Stock and balances are reversed.`)) setStatus.mutate({ id: d.id, status: 'cancelled' }); } }
        : null,
      can(ui.resource, 'delete') ? { separator: true, label: '' } : null,
      can(ui.resource, 'delete')
        ? { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => { if (confirm(`Delete ${d.invoice_number} permanently?`)) deleteDoc.mutate(d.id); } }
        : null,
    ];
    return list.filter((a): a is Action => !!a);
  };

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    ...(ui.isBill ? [{ value: 'paid', label: 'Paid' }] : []),
    ...(ui.convertsTo.length && ['estimate', 'delivery_challan', 'binding_order'].includes(type) ? [{ value: 'converted', label: 'Converted' }] : []),
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const showDue = ui.isBill;
  const showDelivery = ui.showDispatch && type !== 'binding_order';
  const unpaid = data ? data.summary.total_amount - data.summary.amount_paid : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={ui.plural} description={ui.description}>
        {canCreate && (
          <Button onClick={() => router.push(newDocPath(type))} icon={<Plus className="h-4 w-4" />}>
            New {ui.label}
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Documents</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{data?.total ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Total value</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{data ? inr(data.summary.total_amount) : '—'}</p>
        </Card>
        {ui.isBill && (
          <>
            <Card className="!p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide">{ui.side === 'sales' ? 'Received' : 'Paid'}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{data ? inr(data.summary.amount_paid) : '—'}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide">{ui.side === 'sales' ? 'To collect' : 'To pay'}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{data ? inr(unpaid) : '—'}</p>
            </Card>
          </>
        )}
      </div>

      <Card padding={false} className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search number, party, LR / tracking no…`}
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined, page: 1 })}
              className="h-10 rounded-md border border-border bg-white px-2 text-sm text-text-1 dark:bg-card" aria-label="From date" />
            <input type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined, page: 1 })}
              className="h-10 rounded-md border border-border bg-white px-2 text-sm text-text-1 dark:bg-card" aria-label="To date" />
            <Select options={statusOptions} value={filters.status ?? ''} onChange={(v) => setFilters({ ...filters, status: (v || undefined) as InvoiceStatus | undefined, page: 1 })} className="w-36" />
            {ui.isBill && (
              <Select
                options={[{ value: '', label: 'Cash & credit' }, { value: 'cash', label: 'Cash only' }, { value: 'credit', label: 'Credit only' }, { value: 'unpaid', label: 'Unpaid credit' }]}
                value={filters.unpaid ? 'unpaid' : filters.payment_mode ?? ''}
                onChange={(v) => setFilters({ ...filters, page: 1, unpaid: v === 'unpaid' ? 'true' : undefined, payment_mode: v === 'cash' || v === 'credit' ? v : undefined })}
                className="w-40"
              />
            )}
            {ui.requiresApproval && (
              <Select
                options={[{ value: '', label: 'Any approval' }, { value: 'pending', label: 'Awaiting approval' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]}
                value={filters.approval_status ?? ''}
                onChange={(v) => setFilters({ ...filters, approval_status: (v || undefined) as ApprovalStatus | undefined, page: 1 })}
                className="w-44"
              />
            )}
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className={cn('overflow-x-auto transition-opacity', isFetching && !isLoading && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">{ui.numberLabel}</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">{ui.partyLabel}</th>
                {showDue && <th className="px-5 py-3 text-left">Due</th>}
                {showDelivery && <th className="px-5 py-3 text-left">Delivery</th>}
                <th className="px-5 py-3 text-right">Amount</th>
                {showDue && <th className="px-5 py-3 text-right">Balance</th>}
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <FileText className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold text-text-1 mb-1">No {ui.plural.toLowerCase()} {search || filters.status || filters.from ? 'match these filters' : 'yet'}</h3>
                      {canCreate && !search && (
                        <Button className="mt-3" onClick={() => router.push(newDocPath(type))} icon={<Plus className="h-4 w-4" />}>New {ui.label}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="hover:bg-surface/60 dark:hover:bg-border/20 cursor-pointer transition-colors" onClick={() => router.push(docPath(type, d.id))}>
                    <td className="px-5 py-3 font-mono font-medium text-text-1 whitespace-nowrap">{d.invoice_number}</td>
                    <td className="px-5 py-3 text-text-2 whitespace-nowrap">{shortDate(d.issue_date)}</td>
                    <td className="px-5 py-3 text-text-1">
                      <span className="block max-w-[220px] truncate">{d.clients?.name ?? d.party_name ?? (d.payment_mode === 'cash' ? 'Cash' : '—')}</span>
                    </td>
                    {showDue && (
                      <td className="px-5 py-3 whitespace-nowrap">
                        {d.payment_mode === 'cash' || d.balance_due <= 0 ? (
                          <span className="text-text-2">—</span>
                        ) : (
                          <DueBadge daysOverdue={d.days_overdue} daysToDue={d.due_date ? Math.max(0, daysUntil(d.due_date)) : undefined} />
                        )}
                      </td>
                    )}
                    {showDelivery && (
                      <td className="px-5 py-3 whitespace-nowrap">
                        {d.dispatch_mode === 'none' ? <span className="text-text-2">—</span> : <DeliveryBadge status={d.delivery_status} />}
                      </td>
                    )}
                    <td className="px-5 py-3 text-right font-medium text-text-1 whitespace-nowrap">{inr(d.total)}</td>
                    {showDue && <td className="px-5 py-3 text-right whitespace-nowrap">{d.balance_due > 0 ? <span className="font-medium text-amber-600">{inr(d.balance_due)}</span> : <span className="text-text-2">—</span>}</td>}
                    <td className="px-5 py-3 text-center"><DocStatus doc={d} /></td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu
                        trigger={<button className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>}
                        items={actions(d)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-sm text-text-2">Page {filters.page} of {data?.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={(filters.page ?? 1) >= (data?.totalPages ?? 1)} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
