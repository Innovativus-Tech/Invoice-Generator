'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceForm } from '@/components/invoice/invoice-form';
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { PageHeader } from '@/components/layout/page-header';
import { useCreateInvoice, useNextInvoiceNumber } from '@/hooks/use-invoices';
import { useClients } from '@/hooks/use-clients';
import { useSettings } from '@/hooks/use-settings';
import type { InvoiceFormValues, Client } from '@/types';

export default function NewInvoicePage() {
  const router = useRouter();
  const [previewData, setPreviewData] = useState<InvoiceFormValues | null>(null);

  const { data: nextNumber, isLoading: numberLoading } = useNextInvoiceNumber();
  const { data: clients } = useClients();
  const { data: settings } = useSettings();
  const createInvoice = useCreateInvoice();

  const handlePreviewChange = useCallback((data: InvoiceFormValues) => {
    setPreviewData(data);
  }, []);

  const handleSave = async (data: InvoiceFormValues) => {
    const result = await createInvoice.mutateAsync(data);
    if (result?.id) {
      router.push(`/invoices/${result.id}`);
    }
  };

  const selectedClientId = previewData?.client_id ?? null;
  const selectedClient = selectedClientId
    ? (clients || []).find((c: Client) => c.id === selectedClientId) ?? null
    : null;

  if (numberLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description="Create a new invoice with live preview"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form - 60% */}
        <div className="lg:col-span-3">
          <InvoiceForm
            defaultValues={{
              invoice_number: nextNumber || '',
              status: 'draft',
              issue_date: new Date().toISOString().split('T')[0],
              order_id: '',
              order_date: '',
              tax_rate: 0,
              discount_amount: 0,
              notes: '',
              terms: settings?.payment_terms || 'Net 30',
              items: [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0, hsn_sac: '', gst_rate: 18, discount_percent: 0 }],
            }}
            clients={clients || []}
            profile={settings}
            onSave={handleSave}
            onPreviewChange={handlePreviewChange}
          />
        </div>

        {/* Preview - 40% */}
        <div className="lg:col-span-2 hidden lg:block">
          <div className="sticky top-20">
            <InvoicePreview
              formData={previewData}
              profile={settings}
              client={selectedClient}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
