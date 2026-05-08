'use client';

import React, { useEffect, useState } from 'react';
import { useForm, FormProvider, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/dropdown-menu';
import { LineItemsTable } from './line-items-table';
import { Save, Send, CheckCircle } from 'lucide-react';
import { formatIndianCurrency, formatCurrency, calculateGstTotals } from '@/lib/utils';
import type { InvoiceFormValues, Client, Profile, SupplyType } from '@/types';
import { toast } from 'sonner';

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return err.response?.data?.error?.message || err.message || fallback;
};

const InvoiceTotals = ({ control, profile, supplyType }: { control: Control<InvoiceFormValues>; profile: Profile | null | undefined; supplyType: SupplyType }) => {
  const items = useWatch({ control, name: 'items' }) || [];
  const { subtotal, totalGst, total } = calculateGstTotals(
    items.map((i) => ({
      quantity: i?.quantity || 0,
      unit_price: i?.unit_price || 0,
      gst_rate: i?.gst_rate ?? 18,
      discount_percent: i?.discount_percent ?? 0,
    }))
  );

  const displayRate = items[0]?.gst_rate ?? 18;
  const halfRate = displayRate / 2;

  const currency = profile?.currency || 'INR';
  const isInr = currency === 'INR';
  const fmt = (n: number) => isInr ? formatIndianCurrency(n) : formatCurrency(n, currency);

  return (
    <div className="flex justify-end">
      <div className="w-80 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-2">Subtotal</span>
          <span className="text-text-1 font-medium">{fmt(subtotal)}</span>
        </div>

        {supplyType === 'IGST' ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-2">IGST ({displayRate}%)</span>
            <span className="text-text-1 font-medium">{fmt(totalGst)}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-2">CGST ({halfRate}%)</span>
              <span className="text-text-1 font-medium">{fmt(totalGst / 2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-2">SGST ({halfRate}%)</span>
              <span className="text-text-1 font-medium">{fmt(totalGst / 2)}</span>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-3 border-t-2 border-primary">
          <span className="text-base font-semibold text-text-1">Total Amount (with Tax)</span>
          <span className="text-xl font-bold text-primary">{fmt(total)}</span>
        </div>

        <div className="pt-2 text-xs text-text-2 italic border-t border-border">
          IGST OUTPUT
        </div>
      </div>
    </div>
  );
};

const invoiceFormSchema = z.object({
  invoice_number: z.string().min(1, 'Required'),
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'cancelled']),
  issue_date: z.string().min(1, 'Required'),
  order_id: z.string(),
  order_date: z.string(),
  client_id: z.string().nullable(),
  tax_rate: z.number().min(0).max(100),
  discount_amount: z.number().min(0),
  notes: z.string(),
  terms: z.string(),
  supply_type: z.enum(['IGST', 'CGST_SGST']),
  bill_number: z.string(),
  place_of_supply: z.string(),
  items: z.array(z.object({
    description: z.string().min(1, 'Required'),
    quantity: z.number().min(0),
    unit_price: z.number().min(0),
    amount: z.number(),
    sort_order: z.number(),
    hsn_sac: z.string().default(''),
    gst_rate: z.number().min(0).max(100).default(18),
    discount_percent: z.number().min(0).max(100).default(0),
  })).min(1, 'At least one item required'),
});

interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormValues>;
  clients?: Client[];
  profile?: Profile | null;
  onSave: (data: InvoiceFormValues) => Promise<void>;
  onSend?: (data: InvoiceFormValues) => Promise<void>;
  onPreviewChange?: (data: InvoiceFormValues) => void;
  isEdit?: boolean;
}

export function InvoiceForm({
  defaultValues,
  clients = [],
  profile,
  onSave,
  onSend,
  onPreviewChange,
  isEdit = false,
}: InvoiceFormProps) {
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);

  const methods = useForm<InvoiceFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      invoice_number: '',
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      order_id: '',
      order_date: '',
      client_id: null,
      tax_rate: 0,
      discount_amount: 0,
      notes: '',
      terms: '',
      supply_type: 'IGST',
      bill_number: '',
      place_of_supply: '',
      items: [{
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
        sort_order: 0,
        hsn_sac: '',
        gst_rate: 18,
        discount_percent: 0,
      }],
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
  } = methods;

  const supplyType: SupplyType = (useWatch({ control, name: 'supply_type' }) as SupplyType) || 'IGST';
  const clientId = useWatch({ control, name: 'client_id' });
  const terms = useWatch({ control, name: 'terms' });

  // Seed initial preview state immediately on mount so the preview
  // renders before the user makes any changes (fixes BUG 5).
  useEffect(() => {
    if (onPreviewChange) {
      onPreviewChange(methods.getValues() as InvoiceFormValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const subscription = methods.watch((value) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (onPreviewChange) {
          onPreviewChange(value as InvoiceFormValues);
        }
      }, 300);
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [methods.watch, onPreviewChange]);

  const currency = profile?.currency || 'INR';

  useEffect(() => {
    if (!isEdit) return;
    const interval = setInterval(() => {
      const values = methods.getValues();
      onSave(values).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [isEdit, methods, onSave]);

  const prepareItems = (data: InvoiceFormValues) =>
    data.items.map((item, i) => ({
      ...item,
      amount: item.quantity * item.unit_price * (1 - (item.discount_percent ?? 0) / 100),
      sort_order: i,
    }));

  const handleSave = async (data: InvoiceFormValues) => {
    if (saving || sending) return;
    setSaving(true);
    try {
      data.items = prepareItems(data);
      await onSave(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to save invoice. Please try again.');
      toast.error(message);
      console.error('Save invoice error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (data: InvoiceFormValues) => {
    if (!onSend || saving || sending) return;
    setSending(true);
    try {
      data.items = prepareItems(data);
      await onSend(data);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to send invoice. Please try again.');
      toast.error(message);
      console.error('Send invoice error:', error);
    } finally {
      setSending(false);
    }
  };

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: `${c.name}${c.company ? ` (${c.company})` : ''}`,
  }));

  const termsOptions = [
    { value: 'Due on Receipt', label: 'Due on Receipt' },
    { value: 'Net 15', label: 'Net 15' },
    { value: 'Net 30', label: 'Net 30' },
    { value: 'Net 60', label: 'Net 60' },
  ];

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
        {/* Invoice Details */}
        <Card>
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
            Invoice Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Invoice Number"
              {...register('invoice_number')}
              error={errors.invoice_number?.message}
              className="font-mono"
            />
            <Input
              label="Bill Number"
              {...register('bill_number')}
              placeholder="e.g. ITPL/265/26"
              error={errors.bill_number?.message}
              className="font-mono"
            />
            <div className="flex gap-4">
              <Input
                label="Issue Date"
                type="date"
                {...register('issue_date')}
                error={errors.issue_date?.message}
              />
              <Input
                label="Order ID"
                {...register('order_id')}
                placeholder="e.g. PO-2026-001"
                error={errors.order_id?.message}
              />
            </div>
            <Input
              label="Order Date"
              type="date"
              {...register('order_date')}
              error={errors.order_date?.message}
            />
            <Input
              label="Place of Supply"
              {...register('place_of_supply')}
              placeholder="e.g. Delhi"
            />
          </div>

          {/* Supply Type Toggle */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-1 mb-2">Supply Type</label>
            <div className="flex gap-2">
              {(['IGST', 'CGST_SGST'] as SupplyType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('supply_type', type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    supplyType === type
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white dark:bg-card border-border text-text-2 hover:text-text-1 hover:border-primary/50'
                  }`}
                >
                  {type === 'IGST' ? 'IGST' : 'CGST + SGST'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Client */}
        <Card>
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
            Bill To
          </h3>
          <Select
            label="Client"
            options={clientOptions}
            value={clientId || ''}
            onChange={(val) => setValue('client_id', val || null)}
            placeholder="Select a client..."
          />
        </Card>

        {/* Line Items */}
        <Card>
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
            Line Items
          </h3>
          <LineItemsTable currency={currency} />
          {errors.items?.message && (
            <p className="mt-2 text-xs text-danger">{errors.items.message}</p>
          )}
        </Card>

        {/* Totals */}
        <Card>
          <InvoiceTotals control={control} profile={profile} supplyType={supplyType} />
        </Card>

        {/* Notes & Terms */}
        <Card>
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">
            Notes &amp; Terms
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Notes to the client..."
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none dark:bg-card dark:border-border"
              />
            </div>
            <div>
              <Select
                label="Payment Terms"
                options={termsOptions}
                value={terms || ''}
                onChange={(val) => setValue('terms', val)}
                placeholder="Select terms..."
              />
            </div>
          </div>
        </Card>

        {/* Action bar */}
        <div className="sticky bottom-0 bg-white dark:bg-[#0F0E17] border-t border-border -mx-6 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" loading={saving} icon={<Save className="h-4 w-4" />}>
              Save Draft
            </Button>
            {onSend && (
              <Button
                type="button"
                onClick={handleSubmit(handleSend)}
                loading={sending}
                icon={<Send className="h-4 w-4" />}
              >
                Send Invoice
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
