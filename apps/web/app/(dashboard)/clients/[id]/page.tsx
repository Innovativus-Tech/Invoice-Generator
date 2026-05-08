'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/invoice/status-badge';
import { useClient } from '@/hooks/use-clients';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import type { Invoice } from '@/types';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const { can } = usePermissions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-border/40 animate-pulse rounded-lg" />
        <div className="h-[400px] bg-border/40 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-text-1">Client not found</h2>
        <Button variant="secondary" onClick={() => router.push('/clients')} className="mt-4">
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-text-1">{client.name}</h1>
          {client.company && <p className="text-sm text-text-2">{client.company}</p>}
        </div>
        {can('invoices', 'create') && (
          <Button onClick={() => router.push(`/invoices/new?client=${id}`)} icon={<Plus className="h-4 w-4" />} size="sm">
            New Invoice
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client info */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{getInitials(client.name)}</span>
            </div>
            <div>
              <p className="font-semibold text-text-1">{client.name}</p>
              {client.company && <p className="text-sm text-text-2">{client.company}</p>}
            </div>
          </div>

          <div className="space-y-3">
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-text-2" />
                <span className="text-text-1">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-text-2" />
                <span className="text-text-1">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-text-2" />
                <span className="text-text-1">{client.address}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-text-2">Total Invoiced</p>
              <p className="text-lg font-semibold text-text-1">{formatCurrency(client.totalInvoiced || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-text-2">Outstanding</p>
              <p className="text-lg font-semibold text-danger">{formatCurrency(client.outstanding || 0)}</p>
            </div>
          </div>
        </Card>

        {/* Client invoices */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="p-6 pb-0">
              <h3 className="text-lg font-semibold text-text-1">Invoices</h3>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Invoice #</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-2.5 text-right text-xs font-medium text-text-2 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-2.5 text-center text-xs font-medium text-text-2 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(client.invoices || []).map((invoice: Invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-surface/50 dark:hover:bg-card/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <td className="px-6 py-3 font-mono font-medium text-text-1">{invoice.invoice_number}</td>
                      <td className="px-6 py-3 text-text-2">{formatDate(invoice.created_at)}</td>
                      <td className="px-6 py-3 text-right font-medium text-text-1">{formatCurrency(Number(invoice.total), invoice.currency)}</td>
                      <td className="px-6 py-3 text-center"><StatusBadge status={invoice.status} /></td>
                    </tr>
                  ))}
                  {(!client.invoices || client.invoices.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-text-2">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-text-2/50" />
                        No invoices for this client yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
