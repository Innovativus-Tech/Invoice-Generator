'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PartyCombobox } from '@/components/parties/party-combobox';
import { useClients } from '@/hooks/use-clients';
import { useDocuments } from '@/hooks/use-documents';
import { useCreatePayment } from '@/hooks/use-payments';
import { PAYMENT_METHOD_LABEL } from '@/lib/doc-types';
import { balanceLabel, inr, shortDate, todayISO } from '@/lib/utils';
import type { PaymentFormValues, PaymentMethod } from '@/types';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  defaults?: Partial<PaymentFormValues>;
  /** Hide the party picker (e.g. opened from a bill or a party page). */
  lockParty?: boolean;
}

const METHODS: PaymentMethod[] = ['cash', 'upi', 'bank', 'cheque', 'card', 'other'];

export function PaymentDialog({ open, onClose, defaults, lockParty }: PaymentDialogProps) {
  const { data: parties } = useClients();
  const createPayment = useCreatePayment();
  const [form, setForm] = useState<PaymentFormValues>(() => initial(defaults));

  useEffect(() => {
    if (open) setForm(initial(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const billType = form.direction === 'in' ? 'sales_invoice' : 'purchase_bill';
  const { data: bills } = useDocuments(
    { type: billType, client_id: form.client_id || undefined, unpaid: 'true', payment_mode: 'credit', sort: 'issue_date', order: 'asc', limit: 100 },
    open && !!form.client_id
  );
  const openBills = useMemo(() => (bills?.documents ?? []).filter((b) => b.balance_due > 0), [bills]);
  const party = parties?.find((p) => p.id === form.client_id);
  const selectedBill = openBills.find((b) => b.id === form.invoice_id);

  const set = <K extends keyof PaymentFormValues>(k: K, v: PaymentFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickBill = (id: string) => {
    const bill = openBills.find((b) => b.id === id);
    setForm((f) => ({ ...f, invoice_id: id, amount: bill ? bill.balance_due : f.amount }));
  };

  const submit = () => {
    createPayment.mutate(form, { onSuccess: onClose });
  };

  const suggested = party ? Math.abs(party.balance ?? 0) : 0;
  const canSave = form.amount > 0 && (!!form.client_id || !!form.invoice_id) && !!form.payment_date;

  return (
    <Dialog open={open} onClose={onClose} title={form.direction === 'in' ? 'Receive payment' : 'Make payment'} size="lg">
      <div className="space-y-4">
        <Segmented<'in' | 'out'>
          ariaLabel="Direction"
          value={form.direction}
          onChange={(d) => setForm((f) => ({ ...f, direction: d, invoice_id: '' }))}
          options={[
            { value: 'in', label: 'Received from party', icon: <ArrowDownLeft className="h-4 w-4" /> },
            { value: 'out', label: 'Paid to party', icon: <ArrowUpRight className="h-4 w-4" /> },
          ]}
        />

        {!lockParty ? (
          <PartyCombobox
            label="Party *"
            parties={parties ?? []}
            value={form.client_id || null}
            onChange={(p) => setForm((f) => ({ ...f, client_id: p?.id ?? '', invoice_id: '', amount: p ? Math.abs(p.balance ?? 0) || f.amount : f.amount }))}
          />
        ) : party ? (
          <div className="rounded-lg bg-surface dark:bg-border/20 px-3 py-2 text-sm">
            <span className="font-medium text-text-1">{party.name}</span>
            <span className="ml-2 text-text-2">Balance {balanceLabel(party.balance)}</span>
          </div>
        ) : null}

        {form.client_id && (
          <div>
            <label className="block text-sm font-medium text-text-1 mb-1.5">Against bill (optional)</label>
            <select
              value={form.invoice_id}
              onChange={(e) => pickBill(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            >
              <option value="">On account — settle oldest bills first</option>
              {openBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.invoice_number} · {shortDate(b.issue_date)} · balance {inr(b.balance_due)}{b.days_overdue > 0 ? ` · ${b.days_overdue}d overdue` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="Amount (₹) *"
              type="number"
              min={0}
              step="0.01"
              value={form.amount ? String(form.amount) : ''}
              onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
              autoFocus
            />
            {!selectedBill && suggested > 0 && Math.abs(suggested - form.amount) > 0.005 && (
              <button type="button" onClick={() => set('amount', suggested)} className="mt-1 text-xs text-primary hover:underline">
                Use full balance {inr(suggested)}
              </button>
            )}
          </div>
          <Input label="Date *" type="date" value={form.payment_date} onChange={(e) => set('payment_date', e.target.value)} />
        </div>

        <div>
          <span className="block text-sm font-medium text-text-1 mb-1.5">Mode</span>
          <Segmented<PaymentMethod>
            size="sm"
            ariaLabel="Payment mode"
            value={form.mode}
            onChange={(m) => set('mode', m)}
            options={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
            className="flex-wrap"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={form.mode === 'cheque' ? 'Cheque no.' : form.mode === 'upi' || form.mode === 'bank' ? 'UTR / reference' : 'Reference'}
            value={form.reference}
            onChange={(e) => set('reference', e.target.value)}
          />
          <Input label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={createPayment.isPending} disabled={!canSave}>
            {form.direction === 'in' ? 'Save receipt' : 'Save payment'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function initial(defaults?: Partial<PaymentFormValues>): PaymentFormValues {
  return {
    direction: 'in',
    client_id: '',
    invoice_id: '',
    amount: 0,
    payment_date: todayISO(),
    mode: 'cash',
    reference: '',
    notes: '',
    ...defaults,
  };
}
