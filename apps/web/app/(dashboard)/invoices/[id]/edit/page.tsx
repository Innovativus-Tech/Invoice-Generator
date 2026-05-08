'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { InvoiceForm } from '@/components/invoice/invoice-form';
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { Button } from '@/components/ui/button';
import { useInvoice, useUpdateInvoice } from '@/hooks/use-invoices';
import { useClients } from '@/hooks/use-clients';
import { useSettings } from '@/hooks/use-settings';
import type { InvoiceFormValues, Client } from '@/types';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [previewData, setPreviewData] = useState<InvoiceFormValues | null>(null);

  const { data: invoice, isLoading } = useInvoice(id);
  const { data: clients } = useClients();
  const { data: settings } = useSettings();
  const updateInvoice = useUpdateInvoice();

  const handlePreviewChange = useCallback((data: InvoiceFormValues) => {
    setPreviewData(data);
  }, []);

  const handleSave = async (data: InvoiceFormValues) => {
    await updateInvoice.mutateAsync({ id, values: data });
  };

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

  const defaultValues: Partial<InvoiceFormValues> = {
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

  const selectedClient = (previewData?.client_id || invoice.client_id)
    ? (clients || []).find((c: Client) => c.id === (previewData?.client_id || invoice.client_id))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-text-1">
            Edit Invoice <span className="font-mono">{invoice.invoice_number}</span>
          </h1>
          <p className="text-sm text-text-2 mt-0.5">Update invoice details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <InvoiceForm
            defaultValues={defaultValues}
            clients={clients || []}
            profile={settings}
            onSave={handleSave}
            onPreviewChange={handlePreviewChange}
            isEdit
          />
        </div>
        <div className="lg:col-span-2 hidden lg:block">
          <div className="sticky top-20">
            <InvoicePreview
              formData={previewData || defaultValues as InvoiceFormValues}
              profile={settings}
              client={selectedClient}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
