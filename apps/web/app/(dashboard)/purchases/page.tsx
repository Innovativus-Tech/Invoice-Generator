'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookCopy, FilePlus, Layers, Receipt, Redo2, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { DocumentListPage } from '@/components/documents/document-list-page';
import { QuickPurchases } from '@/components/purchases/quick-purchases';
import { BindingRatesCard } from '@/components/purchases/binding-rates-card';
import { useDashboardOverview } from '@/hooks/use-reports';
import { DOC_TYPE_UI, purchasesTabPath } from '@/lib/doc-types';
import { cn, inr } from '@/lib/utils';
import type { DocType } from '@/types';

type Tab =
  | { key: string; label: string; icon: React.ElementType; doc: DocType }
  | { key: string; label: string; icon: React.ElementType; doc?: undefined };

const TABS: Tab[] = [
  { key: DOC_TYPE_UI.purchase_bill.slug, label: 'Purchase Bills', icon: ShoppingCart, doc: 'purchase_bill' },
  { key: DOC_TYPE_UI.binding_order.slug, label: 'Binding Orders', icon: BookCopy, doc: 'binding_order' },
  { key: DOC_TYPE_UI.purchase_return.slug, label: 'Returns', icon: Redo2, doc: 'purchase_return' },
  { key: DOC_TYPE_UI.debit_note.slug, label: 'Debit Notes', icon: FilePlus, doc: 'debit_note' },
  { key: 'quick', label: 'Quick Expenses', icon: Receipt },
  { key: 'binding-rates', label: 'Binding Rates', icon: Layers },
];

/** Everything about buying in one place: bills, binding orders, returns, notes, expenses and the binding rate card. */
function PurchasesSection() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: o } = useDashboardOverview();
  const active = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Purchases" description="Buy books from binders and suppliers — binding charges, payment terms, damage and returns in one place" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Purchases this month</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{o ? inr(o.month.purchases) : '—'}</p>
          <p className="text-xs text-text-2 mt-1">{o ? `${o.month.purchase_count} ${o.month.purchase_count === 1 ? 'bill' : 'bills'}` : ''}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">To pay</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{o ? inr(o.payables.total) : '—'}</p>
          <p className="text-xs text-text-2 mt-1">{o && o.payables.overdue > 0 ? <span className="text-red-600">{inr(o.payables.overdue)} overdue</span> : 'Suppliers & binders'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Open binding orders</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{o ? o.open_documents.binding_orders.count : '—'}</p>
          <p className="text-xs text-text-2 mt-1">{o ? `worth ${inr(o.open_documents.binding_orders.total)}` : ''}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Damaged copies in stock</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{o ? o.stock.damaged_qty : '—'}</p>
          <p className="text-xs text-text-2 mt-1">Send back with a Purchase Return</p>
        </Card>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 dark:bg-card" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = t.key === active.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={selected}
              onClick={() => router.replace(purchasesTabPath(t.key), { scroll: false })}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                selected ? 'bg-primary text-white shadow-sm' : 'text-text-2 hover:text-text-1 hover:bg-surface dark:hover:bg-border/30'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {active.doc ? (
        <DocumentListPage key={active.key} type={active.doc} embedded />
      ) : active.key === 'quick' ? (
        <QuickPurchases />
      ) : (
        <BindingRatesCard />
      )}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesSection />
    </Suspense>
  );
}
