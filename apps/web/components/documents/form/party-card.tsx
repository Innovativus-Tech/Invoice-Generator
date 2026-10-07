'use client';

import React, { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AlertTriangle, Banknote, BookOpenCheck, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PartyCombobox } from '@/components/parties/party-combobox';
import { PartyDrawer } from '@/components/parties/party-drawer';
import { useCreateClient } from '@/hooks/use-clients';
import { usePermissions } from '@/hooks/use-permissions';
import { docUi } from '@/lib/doc-types';
import { partyFields } from '@/lib/document-defaults';
import { computeTotals } from '@/lib/totals';
import { addDaysISO, inr } from '@/lib/utils';
import type { Client, DocType, DocumentFormValues, PaymentMode } from '@/types';

interface PartyCardProps {
  type: DocType;
  parties: Client[];
}

export function PartyCard({ type, parties }: PartyCardProps) {
  const ui = docUi(type);
  const { setValue, getValues, register, formState: { errors } } = useFormContext<DocumentFormValues>();
  const [clientId, paymentMode, items, discType, discValue, postage, other, roundOff] = useWatch<DocumentFormValues>({
    name: ['client_id', 'payment_mode', 'items', 'extra_discount_type', 'extra_discount_value', 'postage_charge', 'other_charges', 'apply_round_off'],
  }) as [string | null, PaymentMode, DocumentFormValues['items'], 'percent' | 'amount', number, number, number, boolean];
  const [drawer, setDrawer] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const createClient = useCreateClient();
  const { can } = usePermissions();

  // Parties of the relevant kind first (customers for sales, binders/suppliers for purchases).
  const sorted = useMemo(() => {
    const rank = (p: Client) => {
      const i = ui.partyTypes.indexOf(p.party_type ?? 'customer');
      return i === -1 ? 99 : i;
    };
    return [...parties].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [parties, ui.partyTypes]);

  const party = parties.find((p) => p.id === clientId) ?? null;
  const isCash = ui.isBill && paymentMode === 'cash';

  const choose = (p: Client | null) => {
    if (!p) {
      setValue('client_id', null, { shouldDirty: true });
      return;
    }
    const fields = partyFields(type, p, getValues('issue_date'));
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'credit_days' || k === 'due_date') {
        if (!ui.isBill || getValues('payment_mode') === 'cash') continue;
      }
      setValue(k as keyof DocumentFormValues, v as never, { shouldDirty: true });
    }
  };

  const setMode = (mode: PaymentMode) => {
    setValue('payment_mode', mode, { shouldDirty: true });
    if (mode === 'credit') {
      const days = party?.credit_days ?? 0;
      setValue('credit_days', days);
      setValue('due_date', addDaysISO(getValues('issue_date'), days));
    }
  };

  // Credit limit warning: current balance + this bill.
  const billTotal = computeTotals({
    items: (items ?? []).map((i) => ({ quantity: i?.quantity ?? 0, unit_price: i?.unit_price ?? 0, discount_percent: i?.discount_percent, gst_rate: i?.gst_rate })),
    extra_discount_type: discType, extra_discount_value: discValue, postage_charge: postage, other_charges: other, apply_round_off: roundOff,
  }).total;
  const limit = party?.credit_limit ?? 0;
  const projected = (party?.balance ?? 0) + (ui.side === 'sales' && ui.isBill && !isCash ? billTotal : 0);
  const overLimit = limit > 0 && projected > limit;

  const defaultPartyType = type === 'binding_order' ? 'binder' : ui.side === 'purchase' ? 'supplier' : 'customer';

  return (
    <Card>
      <div className="flex flex-col gap-4">
        {ui.isBill && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-semibold text-text-2 uppercase tracking-wider sm:w-28">Bill type</span>
            <Segmented<PaymentMode>
              size="lg"
              ariaLabel="Bill type"
              value={paymentMode}
              onChange={setMode}
              options={[
                { value: 'cash', label: ui.side === 'sales' ? 'Cash Sale' : 'Cash Purchase', icon: <Banknote className="h-4 w-4" />, hint: 'Paid now. Party is optional (walk-in customers).' },
                { value: 'credit', label: ui.side === 'sales' ? 'Credit Sale' : 'Credit Purchase', icon: <BookOpenCheck className="h-4 w-4" />, hint: "Goes to the party's ledger; due after their credit days." },
              ]}
            />
            <p className="text-xs text-text-2">
              {isCash ? 'Paid on the spot — no balance is left on the party.' : "Added to the party's account and due after their credit days."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
          <PartyCombobox
            label={`${ui.partyLabel}${!isCash && ui.isBill ? ' *' : isCash ? ' (optional)' : ''}`}
            parties={sorted}
            value={clientId}
            onChange={choose}
            onAddNew={can('clients', 'create') ? (name) => setDrawer({ open: true, name }) : undefined}
            error={errors.client_id?.message}
          />
          {party && (
            <div className="md:pt-7 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-surface dark:bg-border/30 px-2.5 py-1 text-text-2">
                {party.credit_days ? `${party.credit_days} days credit` : 'No credit days set'}
              </span>
            </div>
          )}
        </div>

        {isCash && !party && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Customer name" placeholder="Walk-in customer" {...register('party_name')} />
            <Input label="Phone" placeholder="Optional" inputMode="tel" {...register('party_phone')} />
          </div>
        )}

        {overLimit && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Credit limit {inr(limit)} will be exceeded — balance after this bill would be {inr(projected)}.
            </span>
          </div>
        )}
        {ui.isBill && !isCash && !party && (
          <p className="flex items-center gap-1.5 text-xs text-text-2">
            <Info className="h-3.5 w-3.5" /> Credit bills need a party so the amount can be tracked in their ledger.
          </p>
        )}
      </div>

      <PartyDrawer
        open={drawer.open}
        initialName={drawer.name}
        defaultType={defaultPartyType}
        onClose={() => setDrawer({ open: false, name: '' })}
        loading={createClient.isPending}
        onSave={(values) =>
          createClient.mutate(values, {
            onSuccess: (created) => {
              setDrawer({ open: false, name: '' });
              choose({ ...created, balance: created.opening_balance ?? 0 });
            },
          })
        }
      />
    </Card>
  );
}
