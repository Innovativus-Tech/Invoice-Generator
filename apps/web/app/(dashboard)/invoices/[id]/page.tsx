'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  Download,
  Send,
  CheckCircle,
  Edit,
  Trash2,
  ArrowLeft,
  FileText,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/invoice/status-badge';
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { SendDialog } from '@/components/invoice/send-dialog';
import {
  useInvoice,
  useDeleteInvoice,
  useSendInvoice,
  useUpdateInvoiceStatus,
  useDownloadPdf,
} from '@/hooks/use-invoices';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils';
import type { InvoiceFormValues } from '@/types';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);

  const { data: invoice, isLoading } = useInvoice(id);
  const { data: settings } = useSettings();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const downloadPdf = useDownloadPdf();
  const { can } = usePermissions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-border/40 animate-pulse rounded-lg" />
        <div className="h-[600px] bg-border/40 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-text-1">Invoice not found</h2>
        <Button variant="secondary" onClick={() => router.push('/invoices')} className="mt-4">
          Back to Invoices
        </Button>
      </div>
    );
  }

  const client = invoice.clients ? {
    id: invoice.client_id || '',
    user_id: '',
    name: invoice.clients.name,
    email: invoice.clients.email,
    company: invoice.clients.company,
    address: invoice.clients.address || null,
    phone: invoice.clients.phone || null,
    notes: null,
    gstin: invoice.clients.gstin || null,
    state: invoice.clients.state || null,
    state_code: invoice.clients.state_code || null,
    created_at: '',
  } : null;

  const previewData: InvoiceFormValues = {
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    issue_date: invoice.issue_date,
    order_id: invoice.order_id || '',
    order_date: invoice.order_date || '',
    client_id: invoice.client_id,
    tax_rate: Number(invoice.tax_rate),
    discount_amount: Number(invoice.discount_amount),
    notes: invoice.notes || '',
    terms: invoice.terms || '',
    supply_type: invoice.supply_type || 'IGST',
    bill_number: invoice.bill_number || '',
    place_of_supply: invoice.place_of_supply || '',
    items: (invoice.items || []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      amount: Number(item.amount),
      sort_order: item.sort_order,
      hsn_sac: item.hsn_sac || '',
      gst_rate: Number(item.gst_rate ?? 18),
      discount_percent: Number(item.discount_percent ?? 0),
    })),
  };

  const timeline = [
    { label: 'Created', date: invoice.created_at, icon: FileText, done: true },
    { label: 'Sent', date: invoice.sent_at, icon: Send, done: !!invoice.sent_at },
    { label: 'Viewed', date: invoice.viewed_at, icon: Eye, done: !!invoice.viewed_at },
    { label: 'Paid', date: invoice.paid_at, icon: CheckCircle, done: !!invoice.paid_at },
  ];

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      deleteInvoice.mutate(id, {
        onSuccess: () => router.push('/invoices'),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-1 font-mono">{invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-text-2 mt-0.5">
            {invoice.clients?.name} • {formatCurrency(Number(invoice.total), invoice.currency)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadPdf.mutate({ id, invoiceNumber: invoice.invoice_number })} loading={downloadPdf.isPending}
            icon={<Download className="h-4 w-4" />}>
            PDF
          </Button>
          {can('invoices', 'send') && (
            <Button variant="secondary" size="sm" onClick={() => setSendDialogOpen(true)}
              icon={<Send className="h-4 w-4" />}>
              Send
            </Button>
          )}
          {invoice.status !== 'paid' && can('invoices', 'update') && (
            <Button size="sm"
              onClick={() => updateStatus.mutate({ id, status: 'paid' })}
              loading={updateStatus.isPending}
              icon={<CheckCircle className="h-4 w-4" />}>
              Mark Paid
            </Button>
          )}
          {can('invoices', 'update') && (
            <Button variant="ghost" size="sm" onClick={() => router.push(`/invoices/${id}/edit`)}
              icon={<Edit className="h-4 w-4" />}>
              Edit
            </Button>
          )}
          {can('invoices', 'delete') && (
            <Button variant="ghost" size="sm" onClick={handleDelete}
              icon={<Trash2 className="h-4 w-4 text-danger" />} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-2">
          <InvoicePreview
            formData={previewData}
            profile={settings}
            client={client}
          />
        </div>

        {/* Timeline */}
        <div>
          <Card>
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
              Status Timeline
            </h3>
            <div className="space-y-4">
              {timeline.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.done
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface text-text-2 dark:bg-border/30'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${step.done ? 'text-text-1' : 'text-text-2'}`}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-xs text-text-2 mt-0.5">
                          {formatDate(step.date)} • {formatRelativeDate(step.date)}
                        </p>
                      )}
                    </div>
                    {step.done && (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Invoice Details */}
          <Card className="mt-4">
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
              Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-2">Issue Date</span>
                <span className="text-text-1">{formatDate(invoice.issue_date)}</span>
              </div>
              {invoice.order_id && (
                <div className="flex justify-between">
                  <span className="text-text-2">Order ID</span>
                  <span className="text-text-1">{invoice.order_id}</span>
                </div>
              )}
              {invoice.order_date && (
                <div className="flex justify-between">
                  <span className="text-text-2">Order Date</span>
                  <span className="text-text-1">{formatDate(invoice.order_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-2">Subtotal</span>
                <span className="text-text-1">{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
              </div>
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-2">Tax ({invoice.tax_rate}%)</span>
                  <span className="text-text-1">{formatCurrency(Number(invoice.tax_amount), invoice.currency)}</span>
                </div>
              )}
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-2">Discount</span>
                  <span className="text-text-1">-{formatCurrency(Number(invoice.discount_amount), invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="font-semibold text-text-1">Total</span>
                <span className="font-semibold text-primary">{formatCurrency(Number(invoice.total), invoice.currency)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SendDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        invoice={invoice}
        onSend={async (invoiceId) => { await sendInvoice.mutateAsync(invoiceId); }}
      />
    </div>
  );
}
