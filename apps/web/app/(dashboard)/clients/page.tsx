'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Edit, IndianRupee, MoreHorizontal, Plus, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { PartyDrawer } from '@/components/parties/party-drawer';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { useClients, useCreateClient, useUpdateClient } from '@/hooks/use-clients';
import { usePermissions } from '@/hooks/use-permissions';
import { PARTY_TYPE_LABEL } from '@/lib/doc-types';
import { balanceLabel, cn, getInitials, inr } from '@/lib/utils';
import type { Client, ClientFormValues, PaymentFormValues } from '@/types';

type View = 'all' | 'customers' | 'suppliers';

export default function PartiesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const [drawer, setDrawer] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [payment, setPayment] = useState<Partial<PaymentFormValues> | null>(null);
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients ?? []).filter((c) => {
      const type = c.party_type ?? 'customer';
      if (view === 'customers' && !['customer', 'both'].includes(type)) return false;
      if (view === 'suppliers' && !['supplier', 'binder', 'both'].includes(type)) return false;
      return !q || [c.name, c.company, c.phone, c.gstin, c.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [clients, view, search]);

  const toCollect = (clients ?? []).reduce((s, c) => s + Math.max(c.balance ?? 0, 0), 0);
  const toPay = (clients ?? []).reduce((s, c) => s + Math.max(-(c.balance ?? 0), 0), 0);

  const save = (values: ClientFormValues) => {
    const close = () => setDrawer({ open: false, client: null });
    if (drawer.client) updateClient.mutate({ id: drawer.client.id, values }, { onSuccess: close });
    else createClient.mutate(values, { onSuccess: close });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Parties" description="Customers, suppliers and binders with their running balances">
        {can('clients', 'create') && (
          <Button onClick={() => setDrawer({ open: true, client: null })} icon={<Plus className="h-4 w-4" />}>Add Party</Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Parties</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{clients?.length ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">You will receive</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inr(toCollect)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">You will pay</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{inr(toPay)}</p>
        </Card>
      </div>

      <Card padding={false} className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, GSTIN…"
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            />
          </div>
          <Segmented<View>
            ariaLabel="Party type"
            value={view}
            onChange={setView}
            options={[{ value: 'all', label: 'All' }, { value: 'customers', label: 'Customers' }, { value: 'suppliers', label: 'Suppliers & Binders' }]}
          />
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Party</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-center">Credit days</th>
                <th className="px-5 py-3 text-right">Sales</th>
                <th className="px-5 py-3 text-right">Purchases</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-3"><Skeleton className="h-6 w-full" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Users className="h-10 w-10 mx-auto text-primary/40 mb-3" />
                    <p className="text-text-1 font-medium">{search ? 'No party matches your search' : 'No parties yet'}</p>
                    {!search && can('clients', 'create') && (
                      <Button className="mt-4" onClick={() => setDrawer({ open: true, client: null })} icon={<Plus className="h-4 w-4" />}>Add Party</Button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const balance = c.balance ?? 0;
                  const isSupplier = ['supplier', 'binder'].includes(c.party_type ?? '');
                  return (
                    <tr key={c.id} className="hover:bg-surface/60 dark:hover:bg-border/20 cursor-pointer" onClick={() => router.push(`/clients/${c.id}`)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">{getInitials(c.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-1 truncate">{c.name}</p>
                            <p className="text-xs text-text-2 truncate">{[c.company, c.phone].filter(Boolean).join(' · ') || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-2">{PARTY_TYPE_LABEL[c.party_type ?? 'customer']}</td>
                      <td className="px-5 py-3 text-center text-text-2">{c.credit_days ? `${c.credit_days} days` : '—'}</td>
                      <td className="px-5 py-3 text-right text-text-1">{c.totalInvoiced ? inr(c.totalInvoiced) : '—'}</td>
                      <td className="px-5 py-3 text-right text-text-1">{c.totalPurchased ? inr(c.totalPurchased) : '—'}</td>
                      <td className={cn('px-5 py-3 text-right font-semibold whitespace-nowrap', balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-blue-600' : 'text-text-2')}>
                        {balanceLabel(balance)}
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                          trigger={<button className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>}
                          items={[
                            { label: 'Open ledger', icon: <BookOpen className="h-4 w-4" />, onClick: () => router.push(`/clients/${c.id}?tab=ledger`) },
                            ...(can('payments', 'create')
                              ? [{
                                  label: isSupplier || balance < 0 ? 'Make payment' : 'Receive payment',
                                  icon: <IndianRupee className="h-4 w-4" />,
                                  onClick: () => setPayment({ direction: isSupplier || balance < 0 ? 'out' : 'in', client_id: c.id, amount: Math.abs(balance) }),
                                }]
                              : []),
                            ...(can('clients', 'update') ? [{ label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: () => setDrawer({ open: true, client: c }) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PartyDrawer
        open={drawer.open}
        client={drawer.client}
        onClose={() => setDrawer({ open: false, client: null })}
        defaultType={view === 'suppliers' ? 'supplier' : 'customer'}
        onSave={save}
        loading={createClient.isPending || updateClient.isPending}
      />
      <PaymentDialog open={!!payment} onClose={() => setPayment(null)} defaults={payment ?? undefined} lockParty />
    </div>
  );
}
