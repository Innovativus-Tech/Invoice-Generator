'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/invoice/status-badge';
import { SkeletonRow } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

interface RecentInvoicesProps {
  invoices: Invoice[] | undefined;
  loading: boolean;
}

export function RecentInvoices({ invoices, loading }: RecentInvoicesProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
        <button
          onClick={() => router.push('/invoices')}
          className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View all
        </button>
      </CardHeader>
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-2.5 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Invoice</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Client</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-text-2 uppercase tracking-wider">Date</th>
              <th className="px-6 py-2.5 text-right text-xs font-medium text-text-2 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-2.5 text-center text-xs font-medium text-text-2 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : (
              (invoices || []).slice(0, 5).map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-surface/50 dark:hover:bg-card/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <td className="px-6 py-3 font-mono text-sm font-medium text-text-1">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-3 text-text-1">
                    {invoice.clients?.name || '—'}
                  </td>
                  <td className="px-6 py-3 text-text-2">
                    {formatDate(invoice.created_at)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-text-1">
                    {formatCurrency(Number(invoice.total), invoice.currency)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))
            )}
            {!loading && (!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-text-2">
                  No invoices yet. Create your first one!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
