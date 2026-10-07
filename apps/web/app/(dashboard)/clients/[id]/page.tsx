'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Edit, FileText, IndianRupee, Mail, MapPin, Phone, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { DocStatus, DueBadge } from '@/components/documents/doc-badges';
import { PartyDrawer } from '@/components/parties/party-drawer';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { useClient, useClientLedger, useDeleteClient, useUpdateClient } from '@/hooks/use-clients';
import { usePermissions } from '@/hooks/use-permissions';
import { PARTY_TYPE_LABEL, docPath, docUi, newDocPath } from '@/lib/doc-types';
import { balanceLabel, cn, downloadCsv, getInitials, inr, shortDate, todayISO } from '@/lib/utils';
import type { PaymentFormValues } from '@/types';

type Tab = 'ledger' | 'bills' | 'documents' | 'details';

function financialYearStart(today: string) {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 4 ? `${y}-04-01` : `${y - 1}-04-01`;
}

function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { can } = usePermissions();
  const { data: party, isLoading } = useClient(id);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'ledger');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const { data: ledger, isLoading: ledgerLoading } = useClientLedger(id, range.from || undefined, range.to || undefined);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const [editOpen, setEditOpen] = useState(false);
  const [payment, setPayment] = useState<Partial<PaymentFormValues> | null>(null);

  const today = todayISO();
  const presets = useMemo(() => [
    { label: 'All', from: '', to: '' },
    { label: 'This FY', from: financialYearStart(today), to: '' },
    { label: 'This month', from: `${today.slice(0, 7)}-01`, to: '' },
  ], [today]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!party) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-text-1">Party not found</h2>
        <Button variant="secondary" onClick={() => router.push('/clients')} className="mt-4">Back to Parties</Button>
      </div>
    );
  }

  const balance = party.balance ?? 0;
  const isCustomer = ['customer', 'both'].includes(party.party_type ?? 'customer');
  const isSupplier = ['supplier', 'binder', 'both'].includes(party.party_type ?? '');

  const exportLedger = () => {
    if (!ledger) return;
    downloadCsv(`Ledger-${party.name}.csv`, [
      ['Date', 'Particulars', 'Ref No.', 'Debit', 'Credit', 'Balance'],
      ['', 'Opening balance', '', '', '', balanceLabel(ledger.opening_balance)],
      ...ledger.entries.map((e) => [e.date, e.description, e.number ?? '', e.debit || '', e.credit || '', balanceLabel(e.balance)]),
      ['', 'Closing balance', '', ledger.total_debit, ledger.total_credit, balanceLabel(ledger.closing_balance)],
    ]);
  };

  const onDelete = () => {
    if (confirm(`Delete ${party.name}?`)) deleteClient.mutate(id, { onSuccess: () => router.push('/clients') });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/clients')} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{getInitials(party.name)}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-text-1 truncate">{party.name}</h1>
            <p className="text-sm text-text-2">{[PARTY_TYPE_LABEL[party.party_type ?? 'customer'], party.company, party.phone].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isCustomer && can('invoices', 'create') && (
            <Button size="sm" onClick={() => router.push(newDocPath('sales_invoice', { client: id }))} icon={<Plus className="h-4 w-4" />}>New Sale</Button>
          )}
          {isSupplier && can('purchases', 'create') && (
            <Button size="sm" variant={isCustomer ? 'secondary' : 'primary'} onClick={() => router.push(newDocPath(party.party_type === 'binder' ? 'binding_order' : 'purchase_bill', { client: id }))} icon={<ShoppingCart className="h-4 w-4" />}>
              {party.party_type === 'binder' ? 'New Binding Order' : 'New Purchase'}
            </Button>
          )}
          {can('payments', 'create') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPayment({ direction: 'in', client_id: id, amount: Math.max(balance, 0) })} icon={<IndianRupee className="h-4 w-4" />}>Receive</Button>
              <Button size="sm" variant="secondary" onClick={() => setPayment({ direction: 'out', client_id: id, amount: Math.max(-balance, 0) })} icon={<IndianRupee className="h-4 w-4" />}>Pay</Button>
            </>
          )}
          {can('clients', 'update') && <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} icon={<Edit className="h-4 w-4" />}>Edit</Button>}
          {can('clients', 'delete') && <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete party" icon={<Trash2 className="h-4 w-4 text-danger" />} />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Balance</p>
          <p className={cn('text-2xl font-bold mt-1', balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-blue-600' : 'text-text-1')}>{balanceLabel(balance)}</p>
          <p className="text-xs text-text-2 mt-1">{balance > 0 ? 'They owe you' : balance < 0 ? 'You owe them' : 'Settled'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Overdue</p>
          <p className={cn('text-2xl font-bold mt-1', party.overdue_amount > 0 ? 'text-red-600' : 'text-text-1')}>{inr(party.overdue_amount)}</p>
          <p className="text-xs text-text-2 mt-1">
            {party.max_days_overdue > 0 ? `Oldest bill ${party.max_days_overdue} days late` : party.next_due_date ? `Next due ${shortDate(party.next_due_date)}` : 'Nothing overdue'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Credit terms</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{party.credit_days ? `${party.credit_days} days` : 'Cash / immediate'}</p>
          <p className="text-xs text-text-2 mt-1">{party.credit_limit ? `Limit ${inr(party.credit_limit)}` : 'No credit limit'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Business</p>
          <p className="text-lg font-bold text-text-1 mt-1">Sales {inr(party.totalInvoiced)}</p>
          <p className="text-xs text-text-2 mt-1">Purchases {inr(party.totalPurchased ?? 0)}</p>
        </Card>
      </div>

      <div className="print:hidden">
        <Segmented<Tab>
          ariaLabel="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ledger', label: 'Ledger' },
            { value: 'bills', label: `Open bills (${party.open_bills.length})` },
            { value: 'documents', label: 'Documents' },
            { value: 'details', label: 'Details' },
          ]}
        />
      </div>

      {tab === 'ledger' && (
        <Card padding={false}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-border print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setRange({ from: p.from, to: p.to })}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', range.from === p.from && range.to === p.to ? 'bg-primary text-white' : 'bg-surface text-text-2 hover:text-text-1 dark:bg-border/30')}
                >
                  {p.label}
                </button>
              ))}
              <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-8 rounded-md border border-border bg-white px-2 text-xs dark:bg-card" aria-label="From" />
              <span className="text-xs text-text-2">to</span>
              <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-8 rounded-md border border-border bg-white px-2 text-xs dark:bg-card" aria-label="To" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>Print</Button>
              <Button size="sm" variant="secondary" onClick={exportLedger} icon={<Download className="h-4 w-4" />}>CSV</Button>
            </div>
          </div>
          <div className="hidden print:block p-4">
            <h2 className="text-lg font-semibold">Ledger · {party.name}</h2>
            <p className="text-xs">{range.from || 'Beginning'} to {range.to || today}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Particulars</th>
                  <th className="px-4 py-3 text-left">Ref no.</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerLoading || !ledger ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
                ) : (
                  <>
                    {range.from && (
                      <tr className="bg-surface/60 dark:bg-border/10">
                        <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{shortDate(range.from)}</td>
                        <td className="px-4 py-2.5 font-medium text-text-1" colSpan={4}>Balance brought forward</td>
                        <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{balanceLabel(ledger.opening_balance)}</td>
                      </tr>
                    )}
                    {ledger.entries.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-text-2">No transactions in this period</td></tr>
                    )}
                    {ledger.entries.map((e, i) => (
                      <tr key={i} className="hover:bg-surface/50 dark:hover:bg-border/10">
                        <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{shortDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-text-1">{e.description}</td>
                        <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                          {e.doc_id && e.doc_type ? (
                            <Link href={docPath(e.doc_type, e.doc_id)} className="text-primary hover:underline">{e.number}</Link>
                          ) : (e.number ?? '')}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-1 whitespace-nowrap">{e.debit ? inr(e.debit) : ''}</td>
                        <td className="px-4 py-2.5 text-right text-text-1 whitespace-nowrap">{e.credit ? inr(e.credit) : ''}</td>
                        <td className={cn('px-4 py-2.5 text-right font-medium whitespace-nowrap', e.balance > 0 ? 'text-amber-600' : e.balance < 0 ? 'text-blue-600' : 'text-text-2')}>
                          {balanceLabel(e.balance)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-text-1" colSpan={2}>Closing balance</td>
                      <td className="px-4 py-3 text-right">{inr(ledger.total_debit)}</td>
                      <td className="px-4 py-3 text-right">{inr(ledger.total_credit)}</td>
                      <td className="px-4 py-3 text-right">{balanceLabel(ledger.closing_balance)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'bills' && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Bill</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Due date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {party.open_bills.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-text-2">No open bills — all settled</td></tr>
                ) : party.open_bills.map((b) => (
                  <tr key={b.key}>
                    <td className="px-4 py-2.5">
                      {b.doc_id && b.doc_type ? (
                        <Link href={docPath(b.doc_type, b.doc_id)} className="font-mono text-primary hover:underline">{b.number}</Link>
                      ) : <span className="text-text-1">{b.description}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-text-2">{shortDate(b.date)}</td>
                    <td className="px-4 py-2.5 text-text-2">{shortDate(b.due_date)}</td>
                    <td className="px-4 py-2.5 text-right">{inr(b.amount)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{inr(b.outstanding)}</td>
                    <td className="px-4 py-2.5"><DueBadge daysOverdue={b.days_overdue} daysToDue={b.days_to_due} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Number</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {party.invoices.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-text-2"><FileText className="h-8 w-8 mx-auto mb-2 text-text-2/50" />No documents yet</td></tr>
                ) : party.invoices.map((d) => (
                  <tr key={d.id} className="hover:bg-surface/50 cursor-pointer" onClick={() => router.push(docPath(d.doc_type, d.id))}>
                    <td className="px-4 py-2.5 text-text-2">{docUi(d.doc_type).label}</td>
                    <td className="px-4 py-2.5 font-mono font-medium text-text-1">{d.invoice_number}</td>
                    <td className="px-4 py-2.5 text-text-2">{shortDate(d.issue_date)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{inr(d.total)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <DocStatus doc={{
                        status: d.status,
                        approval_status: d.approval_status,
                        payment_mode: d.payment_mode,
                        payment_status: docUi(d.doc_type).isBill && d.status !== 'cancelled'
                          ? (d.amount_paid >= d.total - 0.005 ? 'paid' : d.amount_paid > 0 ? 'partial' : 'unpaid')
                          : null,
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">Contact</h3>
            <div className="space-y-3 text-sm">
              {party.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-text-2" />{party.phone}</p>}
              {party.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-text-2" />{party.email}</p>}
              {party.gstin && <p className="font-mono text-text-1">GSTIN: {party.gstin}</p>}
              {party.notes && <p className="text-text-2 whitespace-pre-line">{party.notes}</p>}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">Addresses</h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-2">
                <MapPin className="h-4 w-4 text-text-2 mt-0.5" />
                <div>
                  <p className="text-xs text-text-2 uppercase">Billing</p>
                  <p className="text-text-1">{[party.address, party.state, party.pincode].filter(Boolean).join(', ') || '—'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <MapPin className="h-4 w-4 text-text-2 mt-0.5" />
                <div>
                  <p className="text-xs text-text-2 uppercase">Shipping (books sent to)</p>
                  <p className="text-text-1">{[party.shipping_address, party.shipping_state, party.shipping_pincode].filter(Boolean).join(', ') || 'Same as billing'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <PartyDrawer
        open={editOpen}
        client={party}
        onClose={() => setEditOpen(false)}
        onSave={(values) => updateClient.mutate({ id, values }, { onSuccess: () => setEditOpen(false) })}
        loading={updateClient.isPending}
      />
      <PaymentDialog open={!!payment} onClose={() => setPayment(null)} defaults={payment ?? undefined} lockParty />
    </div>
  );
}

export default function PartyDetailPage() {
  return (
    <Suspense>
      <PartyDetail />
    </Suspense>
  );
}
