'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Send, Eye, Edit, Trash2, MoreHorizontal, CheckCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/invoice/status-badge';
import { SendDialog } from '@/components/invoice/send-dialog';
import { DropdownMenu, Select } from '@/components/ui/dropdown-menu';
import { SkeletonRow } from '@/components/ui/skeleton';
import { useInvoices, useDeleteInvoice, useSendInvoice, useUpdateInvoiceStatus, useDownloadPdf } from '@/hooks/use-invoices';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice, InvoiceFilters, InvoiceStatus } from '@/types';

type InvoiceAction = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean;
};

export default function InvoicesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);

  const { data, isLoading } = useInvoices({ ...filters, search: search || undefined });
  const deleteInvoice = useDeleteInvoice();
  const sendInvoiceMutation = useSendInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const downloadPdf = useDownloadPdf();
  const { can } = usePermissions();

  const invoices = data?.invoices || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'paid', label: 'Paid' },

    { value: 'cancelled', label: 'Cancelled' },
  ];

  const sortOptions = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'total', label: 'Amount' },
    { value: 'invoice_number', label: 'Invoice #' },
  ];

  const getActions = (invoice: Invoice) => {
    const actions: Array<InvoiceAction | null> = [
      { label: 'View', icon: <Eye className="h-4 w-4" />, onClick: () => router.push(`/invoices/${invoice.id}`) },
      can('invoices', 'update') ? { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: () => router.push(`/invoices/${invoice.id}/edit`) } : null,
      { separator: true, label: '' },
      { label: 'Download', icon: <Download className="h-4 w-4" />, onClick: () => downloadPdf.mutate({ id: invoice.id, invoiceNumber: invoice.invoice_number }) },
      can('invoices', 'send') ? { label: 'Send', icon: <Send className="h-4 w-4" />, onClick: () => setSendInvoice(invoice) } : null,
      can('invoices', 'update') ? { label: 'Mark Paid', icon: <CheckCircle className="h-4 w-4" />, onClick: () => updateStatus.mutate({ id: invoice.id, status: 'paid' }) } : null,
      can('invoices', 'delete') ? { separator: true, label: '' } : null,
      can('invoices', 'delete') ? { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => { if (confirm('Delete this invoice?')) deleteInvoice.mutate(invoice.id); } } : null,
    ];
    return actions.filter((action): action is InvoiceAction => Boolean(action));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description={`${total} total invoices`}>
        {can('invoices', 'create') && (
          <Button onClick={() => router.push('/invoices/new')} icon={<Plus className="h-4 w-4" />}>
            New Invoice
          </Button>
        )}
      </PageHeader>

      {/* Filter bar */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices..."
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:border-border"
            />
          </div>
          <Select
            options={statusOptions}
            value={filters.status || ''}
            onChange={(val) => setFilters({ ...filters, status: (val || undefined) as InvoiceStatus | undefined, page: 1 })}
            className="w-40"
          />
          <Select
            options={sortOptions}
            value={filters.sort || 'created_at'}
            onChange={(val) => setFilters({ ...filters, sort: val as InvoiceFilters['sort'] })}
            className="w-40"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Issue Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-2 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-2 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-2 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-text-1 mb-1">No invoices yet</h3>
                      <p className="text-text-2 mb-4">Create your first invoice to get started</p>
                      {can('invoices', 'create') && (
                        <Button onClick={() => router.push('/invoices/new')} icon={<Plus className="h-4 w-4" />}>
                          Create Invoice
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice: Invoice) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-surface/50 dark:hover:bg-card/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-sm font-medium text-text-1">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-text-1">{invoice.clients?.name || '—'}</td>
                    <td className="px-6 py-4 text-text-2">{formatDate(invoice.issue_date)}</td>
                    <td className="px-6 py-4 text-text-2">{invoice.order_id || '—'}</td>
                    <td className="px-6 py-4 text-right font-medium text-text-1">{formatCurrency(Number(invoice.total), invoice.currency)}</td>
                    <td className="px-6 py-4 text-center"><StatusBadge status={invoice.status} /></td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu
                        trigger={
                          <button className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                        items={getActions(invoice)}
                      />
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <span className="text-sm text-text-2">
              Page {filters.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page || 1) <= 1}
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                icon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page || 1) >= totalPages}
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Send dialog */}
      <SendDialog
        open={!!sendInvoice}
        onClose={() => setSendInvoice(null)}
        invoice={sendInvoice}
        onSend={async (id) => { await sendInvoiceMutation.mutateAsync(id); }}
      />
    </div>
  );
}
