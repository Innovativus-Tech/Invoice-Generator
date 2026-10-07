'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PARTY_TYPE_LABEL } from '@/lib/doc-types';
import { cn } from '@/lib/utils';
import type { Client, ClientFormValues, PartyType } from '@/types';

const EMPTY: ClientFormValues = {
  name: '', email: '', company: '', address: '', phone: '', notes: '', gstin: '', state: '', state_code: '',
  party_type: 'customer', credit_days: 0, credit_limit: 0, opening_balance: 0,
  pincode: '', shipping_address: '', shipping_state: '', shipping_pincode: '',
};

function fromClient(c: Client): ClientFormValues {
  return {
    name: c.name || '',
    email: c.email || '',
    company: c.company || '',
    address: c.address || '',
    phone: c.phone || '',
    notes: c.notes || '',
    gstin: c.gstin || '',
    state: c.state || '',
    state_code: c.state_code || '',
    party_type: c.party_type || 'customer',
    credit_days: c.credit_days ?? 0,
    credit_limit: c.credit_limit ?? 0,
    opening_balance: c.opening_balance ?? 0,
    pincode: c.pincode || '',
    shipping_address: c.shipping_address || '',
    shipping_state: c.shipping_state || '',
    shipping_pincode: c.shipping_pincode || '',
  };
}

const textareaCls =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none dark:bg-[#0F0E17] dark:border-border';

interface PartyDrawerProps {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  defaultType?: PartyType;
  /** Pre-fills the name for a new party (e.g. typed into the bill's party search). */
  initialName?: string;
  onSave: (values: ClientFormValues) => void;
  loading: boolean;
}

export function PartyDrawer({ open, onClose, client, defaultType = 'customer', initialName = '', onSave, loading }: PartyDrawerProps) {
  const [form, setForm] = useState<ClientFormValues>(EMPTY);
  const [balanceSide, setBalanceSide] = useState<'dr' | 'cr'>('dr');
  const [shipSame, setShipSame] = useState(true);

  useEffect(() => {
    if (!open) return;
    const next = client ? fromClient(client) : { ...EMPTY, party_type: defaultType, name: initialName };
    setBalanceSide(next.opening_balance < 0 ? 'cr' : 'dr');
    setShipSame(!next.shipping_address);
    setForm({ ...next, opening_balance: Math.abs(next.opening_balance) });
  }, [client, open, defaultType, initialName]);

  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    onSave({
      ...form,
      opening_balance: (balanceSide === 'cr' ? -1 : 1) * (Number(form.opening_balance) || 0),
      credit_days: Number(form.credit_days) || 0,
      credit_limit: Number(form.credit_limit) || 0,
      ...(shipSame && { shipping_address: '', shipping_state: '', shipping_pincode: '' }),
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-card border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-1">{client ? 'Edit Party' : 'New Party'}</h2>
              <button onClick={onClose} className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface transition-colors" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Party type</label>
                <div className="grid grid-cols-4 gap-1 bg-surface dark:bg-[#0F0E17] rounded-lg p-1">
                  {(Object.keys(PARTY_TYPE_LABEL) as PartyType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('party_type', t)}
                      className={cn(
                        'px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                        form.party_type === t ? 'bg-white dark:bg-card text-primary shadow-sm' : 'text-text-2 hover:text-text-1'
                      )}
                    >
                      {t === 'both' ? 'Both' : PARTY_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <Input label="Party name *" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
                <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <Input label="Company / Shop" value={form.company} onChange={(e) => set('company', e.target.value)} />

              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">Billing address</h3>
                <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={textareaCls} placeholder="Street, area, city" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Delhi" />
                  <Input label="State code" value={form.state_code} onChange={(e) => set('state_code', e.target.value)} placeholder="07" className="font-mono" />
                  <Input label="PIN code" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" />
                </div>
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                  placeholder="09DHJPK7527M1ZM"
                  className="font-mono"
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">Shipping address (books are sent here)</h3>
                  <label className="flex items-center gap-2 text-xs text-text-2 cursor-pointer">
                    <input type="checkbox" checked={shipSame} onChange={(e) => setShipSame(e.target.checked)} className="h-3.5 w-3.5 rounded border-border text-primary" />
                    Same as billing
                  </label>
                </div>
                {!shipSame && (
                  <>
                    <textarea rows={2} value={form.shipping_address} onChange={(e) => set('shipping_address', e.target.value)} className={textareaCls} placeholder="Godown / shop address" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="State" value={form.shipping_state} onChange={(e) => set('shipping_state', e.target.value)} />
                      <Input label="PIN code" value={form.shipping_pincode} onChange={(e) => set('shipping_pincode', e.target.value)} inputMode="numeric" />
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">Credit & balance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      label="Credit days"
                      type="number"
                      min={0}
                      value={String(form.credit_days)}
                      onChange={(e) => set('credit_days', parseInt(e.target.value, 10) || 0)}
                    />
                    <p className="mt-1 text-xs text-text-2">Days the party takes to pay. Sets each bill&apos;s due date.</p>
                  </div>
                  <Input
                    label="Credit limit (₹, optional)"
                    type="number"
                    min={0}
                    value={String(form.credit_limit || '')}
                    onChange={(e) => set('credit_limit', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Opening balance</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={String(form.opening_balance || '')}
                      onChange={(e) => set('opening_balance', parseFloat(e.target.value) || 0)}
                      className="flex-1 h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
                      placeholder="0"
                    />
                    <div className="flex bg-surface dark:bg-[#0F0E17] rounded-md p-1 text-xs">
                      {(['dr', 'cr'] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setBalanceSide(side)}
                          className={cn('px-3 rounded font-medium', balanceSide === side ? 'bg-white dark:bg-card text-primary shadow-sm' : 'text-text-2')}
                        >
                          {side === 'dr' ? 'They owe us' : 'We owe them'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={textareaCls} />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={submit} loading={loading} disabled={!form.name.trim()}>
                {client ? 'Update Party' : 'Create Party'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
