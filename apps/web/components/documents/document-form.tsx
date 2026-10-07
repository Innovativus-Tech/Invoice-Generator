'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Link2, Save, Send, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { LineItemsTable } from '@/components/invoice/line-items-table';
import { PartyCard } from './form/party-card';
import { ChargesCard } from './form/charges-card';
import { DispatchCard } from './form/dispatch-card';
import { useDocuments } from '@/hooks/use-documents';
import { docPath, docUi } from '@/lib/doc-types';
import { addDaysISO, apiError, inr, shortDate } from '@/lib/utils';
import type { BillingDocument, Client, DocType, DocumentFormValues, SupplyType } from '@/types';

export type SaveIntent = 'save' | 'save_new' | 'send';

const schema = z
  .object({
    issue_date: z.string().min(1, 'Date is required'),
    items: z
      .array(z.object({ description: z.string().trim().min(1, 'Describe the item'), quantity: z.number().min(0, 'Invalid quantity') }).passthrough())
      .min(1, 'Add at least one line item'),
  })
  .passthrough();

const textareaCls =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none dark:bg-card';
const sectionTitle = 'text-sm font-semibold text-text-2 uppercase tracking-wider mb-4';

/** Which bills a return / note can be raised against. */
const SOURCE_TYPE: Partial<Record<DocType, DocType>> = {
  sales_return: 'sales_invoice',
  credit_note: 'sales_invoice',
  purchase_return: 'purchase_bill',
  debit_note: 'purchase_bill',
};

interface DocumentFormProps {
  type: DocType;
  defaultValues: DocumentFormValues;
  parties: Client[];
  isEdit?: boolean;
  sourceDoc?: Pick<BillingDocument, 'id' | 'doc_type' | 'invoice_number'> | null;
  canSend?: boolean;
  onSubmit: (values: DocumentFormValues, intent: SaveIntent) => Promise<void>;
  onPreviewChange?: (values: DocumentFormValues) => void;
}

export function DocumentForm({ type, defaultValues, parties, isEdit, sourceDoc, canSend, onSubmit, onPreviewChange }: DocumentFormProps) {
  const ui = docUi(type);
  const [busy, setBusy] = useState<SaveIntent | null>(null);
  const [saved, setSaved] = useState(false);

  const methods = useForm<DocumentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues,
  });
  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = methods;

  const [clientId, paymentMode, issueDate, creditDays, supplyType, sourceDocId, shippingAddress, billingAddress] = useWatch({
    control,
    name: ['client_id', 'payment_mode', 'issue_date', 'credit_days', 'supply_type', 'source_doc_id', 'shipping_address', 'billing_address'],
  });
  const [shipSame, setShipSame] = useState(() => !defaultValues.shipping_address || defaultValues.shipping_address === defaultValues.billing_address);

  // Live preview (debounced).
  useEffect(() => {
    onPreviewChange?.(getValues());
    let timer: ReturnType<typeof setTimeout>;
    const sub = methods.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => onPreviewChange?.(values as DocumentFormValues), 250);
    });
    return () => {
      sub.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Due date follows the bill date and credit days (but a stored due date is kept on open).
  const termsSeen = useRef(false);
  useEffect(() => {
    if (!termsSeen.current) {
      termsSeen.current = true;
      if (isEdit) return;
    }
    if (!ui.isBill || paymentMode === 'cash') return;
    setValue('due_date', addDaysISO(issueDate, Number(creditDays) || 0));
  }, [issueDate, creditDays, paymentMode, ui.isBill, isEdit, setValue]);

  useEffect(() => {
    if (shipSame) setValue('shipping_address', billingAddress);
  }, [shipSame, billingAddress, setValue]);

  // Bills of this party that a return / note can be raised against.
  const sourceType = SOURCE_TYPE[type];
  const { data: partyBills } = useDocuments(
    { type: sourceType, client_id: clientId ?? undefined, limit: 50, sort: 'issue_date', order: 'desc' },
    !!sourceType && !!clientId
  );
  const billOptions = useMemo(() => (partyBills?.documents ?? []).filter((d) => d.status !== 'cancelled'), [partyBills]);

  const submit = (intent: SaveIntent) =>
    handleSubmit(async (values) => {
      if (busy) return;
      if (ui.isBill && values.payment_mode === 'credit' && !values.client_id) {
        methods.setError('client_id', { message: 'Select a party for a credit bill, or switch to Cash.' });
        toast.error('Select a party for a credit bill, or switch to Cash.');
        return;
      }
      setBusy(intent);
      try {
        await onSubmit(
          {
            ...values,
            items: values.items.map((item, i) => ({
              ...item,
              sort_order: i,
              amount: (item.quantity || 0) * (item.unit_price || 0) * (1 - (item.discount_percent || 0) / 100),
            })),
          },
          intent
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        toast.error(apiError(error, 'Could not save'));
      } finally {
        setBusy(null);
      }
    }, (errs) => {
      const first = errs.items?.message ?? errs.items?.root?.message ?? (Array.isArray(errs.items) ? 'Every line needs a description' : null) ?? errs.issue_date?.message;
      toast.error(first || 'Please check the highlighted fields');
    });

  // Enter moves on instead of submitting (fast keyboard entry in line items).
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.tagName === 'INPUT') e.preventDefault();
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => { e.preventDefault(); submit('save')(); }} onKeyDown={onKeyDown} className="space-y-6">
        {sourceDoc && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-text-1">
            <Link2 className="h-4 w-4 text-primary" />
            Created from {docUi(sourceDoc.doc_type).label}{' '}
            <Link href={docPath(sourceDoc.doc_type, sourceDoc.id)} className="font-mono font-medium text-primary hover:underline">
              {sourceDoc.invoice_number}
            </Link>
            {docUi(sourceDoc.doc_type).convertsTo.includes(type) && ['estimate', 'delivery_challan', 'binding_order'].includes(sourceDoc.doc_type) && (
              <span className="text-text-2">— it will be marked converted.</span>
            )}
          </div>
        )}

        <PartyCard type={type} parties={parties} />

        {/* Details */}
        <Card>
          <h3 className={sectionTitle}>{ui.label} details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Input label={ui.numberLabel} className="font-mono" {...register('invoice_number')} />
              {!isEdit && <p className="mt-1 text-xs text-text-2">Own series for {ui.plural.toLowerCase()}.</p>}
            </div>
            <Input label="Date" type="date" {...register('issue_date')} error={errors.issue_date?.message} />
            {ui.isBill && paymentMode === 'credit' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Credit days" type="number" min={0} {...register('credit_days', { valueAsNumber: true })} />
                <Input label="Due date" type="date" {...register('due_date')} />
              </div>
            )}
            {type === 'estimate' && <Input label="Valid until" type="date" {...register('valid_until')} />}
            {ui.side === 'purchase' && type !== 'binding_order' && (
              <>
                <Input label="Supplier's bill / ref no." className="font-mono" {...register('party_ref_number')} />
                <Input label="Supplier's bill date" type="date" {...register('party_ref_date')} />
              </>
            )}
            {(type === 'sales_invoice' || type === 'delivery_challan' || type === 'estimate') && (
              <>
                <Input label="Order / PO no." {...register('order_id')} />
                <Input label="Order date" type="date" {...register('order_date')} />
              </>
            )}
            {type === 'sales_invoice' && <Input label="Bill no. to print (optional)" placeholder="e.g. ITPL/265/26" className="font-mono" {...register('bill_number')} />}
            <Input label="Place of supply" placeholder="State" {...register('place_of_supply')} />
            <div>
              <span className="block text-sm font-medium text-text-1 mb-1.5">GST type</span>
              <Segmented<SupplyType>
                size="sm"
                ariaLabel="GST type"
                value={supplyType ?? 'IGST'}
                onChange={(v) => setValue('supply_type', v, { shouldDirty: true })}
                options={[{ value: 'IGST', label: 'IGST', hint: 'Inter-state supply' }, { value: 'CGST_SGST', label: 'CGST + SGST', hint: 'Within your state' }]}
              />
            </div>
          </div>

          {sourceType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Against {docUi(sourceType).label.toLowerCase()}</label>
                <select
                  value={sourceDocId ?? ''}
                  onChange={(e) => setValue('source_doc_id', e.target.value || null, { shouldDirty: true })}
                  disabled={!clientId}
                  className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card disabled:opacity-60"
                >
                  <option value="">{clientId ? 'Not linked to a bill' : 'Select the party first'}</option>
                  {sourceDoc && !billOptions.some((b) => b.id === sourceDoc.id) && (
                    <option value={sourceDoc.id}>{sourceDoc.invoice_number}</option>
                  )}
                  {billOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.invoice_number} · {shortDate(b.issue_date)} · {inr(b.total)}{b.balance_due > 0 ? ` · due ${inr(b.balance_due)}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-2">Linked bills are settled first by this {ui.label.toLowerCase()}.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Reason</label>
                <textarea rows={2} {...register('reason')} className={textareaCls} placeholder={type.includes('return') ? 'e.g. Damaged in transit, wrong title' : 'e.g. Rate difference, short supply'} />
              </div>
            </div>
          )}

          {type === 'sales_return' && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Returns take effect after an owner or admin approves them — stock comes back and the party is credited then.
            </p>
          )}
          {ui.stock !== 'none' && (
            <label className="mt-4 flex items-center gap-2 text-sm text-text-1 cursor-pointer">
              <input type="checkbox" {...register('affects_stock')} className="h-4 w-4 rounded border-border text-primary" />
              Update stock ({ui.stock === 'out' ? 'reduce' : 'add'} quantities of linked items)
            </label>
          )}
        </Card>

        {/* Addresses */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className={sectionTitle}>{ui.side === 'purchase' ? `${ui.partyLabel} address` : 'Billing address'}</h3>
              <textarea rows={3} {...register('billing_address')} className={textareaCls} placeholder="Filled from the party — edit for this bill only" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{ui.side === 'purchase' ? 'Deliver to' : 'Shipping address'}</h3>
                <label className="flex items-center gap-2 text-xs text-text-2 cursor-pointer">
                  <input type="checkbox" checked={shipSame} onChange={(e) => setShipSame(e.target.checked)} className="h-3.5 w-3.5 rounded border-border text-primary" />
                  Same as billing
                </label>
              </div>
              {shipSame ? (
                <p className="text-sm text-text-2 whitespace-pre-line">{shippingAddress || '—'}</p>
              ) : (
                <div className="space-y-2">
                  <input {...register('shipping_name')} placeholder="Receiver name" className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card" />
                  <textarea rows={2} {...register('shipping_address')} className={textareaCls} placeholder="Where the books are delivered" />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Line items */}
        <Card>
          <h3 className={sectionTitle}>Items</h3>
          <LineItemsTable docType={type} />
          {errors.items?.message && <p className="mt-2 text-xs text-danger">{errors.items.message}</p>}
        </Card>

        <ChargesCard type={type} />

        {ui.showDispatch && <DispatchCard />}

        <Card>
          <h3 className={sectionTitle}>Notes</h3>
          <textarea rows={3} {...register('notes')} className={textareaCls} placeholder="Printed on the document (e.g. bank instructions, delivery remarks)" />
        </Card>

        {/* Action bar */}
        <div className="sticky bottom-0 z-10 -mx-6 flex items-center justify-between border-t border-border bg-white px-6 py-4 dark:bg-[#0F0E17]">
          <div className="flex items-center gap-2 text-xs">
            {saved && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isEdit && (
              <Button type="button" variant="ghost" onClick={submit('save_new')} loading={busy === 'save_new'} disabled={!!busy} icon={<FilePlus2 className="h-4 w-4" />}>
                Save & New
              </Button>
            )}
            {canSend && (
              <Button type="button" variant="secondary" onClick={submit('send')} loading={busy === 'send'} disabled={!!busy} icon={<Send className="h-4 w-4" />}>
                Save & Email
              </Button>
            )}
            <Button type="submit" loading={busy === 'save'} disabled={!!busy} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Save changes' : `Save ${ui.label}`}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
