'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Mail, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useClients, useCreateClient, useUpdateClient } from '@/hooks/use-clients';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, getInitials } from '@/lib/utils';
import type { Client, ClientFormValues } from '@/types';

function ClientDrawer({
  open,
  onClose,
  client,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  onSave: (values: ClientFormValues) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ClientFormValues>({
    name: client?.name || '',
    email: client?.email || '',
    company: client?.company || '',
    address: client?.address || '',
    phone: client?.phone || '',
    notes: client?.notes || '',
    gstin: client?.gstin || '',
    state: client?.state || '',
    state_code: client?.state_code || '',
  });

  React.useEffect(() => {
    if (client) {
      setForm({
        name: client.name || '',
        email: client.email || '',
        company: client.company || '',
        address: client.address || '',
        phone: client.phone || '',
        notes: client.notes || '',
        gstin: client.gstin || '',
        state: client.state || '',
        state_code: client.state_code || '',
      });
    } else {
      setForm({ name: '', email: '', company: '', address: '', phone: '', notes: '', gstin: '', state: '', state_code: '' });
    }
  }, [client, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-card border-l border-border z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-1">
                  {client ? 'Edit Client' : 'New Client'}
                </h2>
                <button onClick={onClose} className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 09DHJPK7527M1ZM"
                  className="font-mono"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Delhi" />
                  <Input label="State Code" value={form.state_code} onChange={(e) => setForm({ ...form, state_code: e.target.value })} placeholder="e.g. 07" className="font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none dark:bg-[#0F0E17] dark:border-border"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                  <Button className="flex-1" onClick={() => onSave(form)} loading={loading} disabled={!form.name}>
                    {client ? 'Update' : 'Create'} Client
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { can } = usePermissions();

  const handleSave = (values: ClientFormValues) => {
    if (editingClient) {
      updateClient.mutate(
        { id: editingClient.id, values },
        { onSuccess: () => { setDrawerOpen(false); setEditingClient(null); } }
      );
    } else {
      createClient.mutate(values, {
        onSuccess: () => { setDrawerOpen(false); },
      });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setDrawerOpen(true);
  };

  const colors = ['from-violet-500 to-purple-500', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-green-500', 'from-amber-500 to-orange-500', 'from-pink-500 to-rose-500'];

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description={`${(clients || []).length} clients`}>
        {can('clients', 'create') && <Button onClick={handleAdd} icon={<Plus className="h-4 w-4" />}>Add Client</Button>}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-card rounded-xl border border-border p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-border/40" />
                <div className="space-y-2"><div className="h-4 w-24 bg-border/40 rounded" /><div className="h-3 w-16 bg-border/40 rounded" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (clients || []).length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text-1 mb-1">No clients yet</h3>
            <p className="text-text-2 mb-4">Add your first client to get started</p>
            {can('clients', 'create') && <Button onClick={handleAdd} icon={<Plus className="h-4 w-4" />}>Add Client</Button>}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clients || []).map((client: Client, i: number) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Card hover onClick={() => router.push(`/clients/${client.id}`)} className="group">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-sm font-bold text-white">{getInitials(client.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-1 truncate">{client.name}</p>
                    {client.company && <p className="text-xs text-text-2 truncate">{client.company}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-text-2">Invoiced</p>
                    <p className="font-medium text-text-1">{formatCurrency(client.totalInvoiced || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-2">Outstanding</p>
                    <p className="font-medium text-text-1">{formatCurrency(client.outstanding || 0)}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-text-2">
                    {client.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>
                    )}
                  </div>
                  {can('clients', 'update') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(client); }}
                      className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ClientDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingClient(null); }}
        client={editingClient}
        onSave={handleSave}
        loading={createClient.isPending || updateClient.isPending}
      />
    </div>
  );
}
