'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowDownLeft, BookCopy, ClipboardList, FileText, IndianRupee, Package, Phone, Plus, ShieldAlert,
  ShoppingCart, TrendingDown, TrendingUp, Truck, Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SalesPurchaseChart } from '@/components/charts/sales-purchase-chart';
import { DeliveryBadge, DocStatus } from '@/components/documents/doc-badges';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { useDashboardOverview } from '@/hooks/use-reports';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { docPath, docUi, newDocPath } from '@/lib/doc-types';
import { cn, inr, plural, shortDate } from '@/lib/utils';
import type { AgingBuckets, DocType, PaymentFormValues } from '@/types';

function Tile({
  label, value, hint, icon: Icon, tone = 'primary', href,
}: { label: string; value: string; hint?: React.ReactNode; icon: React.ElementType; tone?: 'primary' | 'green' | 'amber' | 'blue' | 'red'; href?: string }) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30',
  };
  const body = (
    <Card className="!p-5 h-full" hover={!!href}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-2 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-text-1 mt-1.5 truncate">{value}</p>
        </div>
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint && <div className="text-xs text-text-2 mt-2">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padding={false} className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-text-1">{title}</h3>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-5 pb-5 text-sm text-text-2">{children}</p>;

const AGING: { key: keyof AgingBuckets; label: string }[] = [
  { key: 'not_due', label: 'Not yet due' },
  { key: 'd1_30', label: '1–30 days late' },
  { key: 'd31_60', label: '31–60 days late' },
  { key: 'd61_90', label: '61–90 days late' },
  { key: 'd90_plus', label: '90+ days late' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data: o, isLoading } = useDashboardOverview();
  const [payment, setPayment] = useState<Partial<PaymentFormValues> | null>(null);

  const quick: { type: DocType; label: string; icon: React.ElementType }[] = [
    { type: 'sales_invoice', label: 'New Sale', icon: Plus },
    { type: 'estimate', label: 'Estimate', icon: FileText },
    { type: 'delivery_challan', label: 'Challan', icon: Truck },
    { type: 'purchase_bill', label: 'Purchase', icon: ShoppingCart },
    { type: 'binding_order', label: 'Binding Order', icon: BookCopy },
  ];

  const trend = o?.month.trend_percent ?? null;
  const agingMax = o ? Math.max(...AGING.map((a) => o.receivables.buckets[a.key]), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header + quick actions */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-1">Dashboard</h1>
          <p className="text-sm text-text-2 mt-1">
            {user?.org_name ? `${user.org_name} · ` : ''}{o ? `as of ${shortDate(o.as_of)}` : 'Business overview'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.filter((q) => can(docUi(q.type).resource, 'create')).map((q, i) => (
            <Button key={q.type} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => router.push(newDocPath(q.type))} icon={<q.icon className="h-4 w-4" />}>
              {q.label}
            </Button>
          ))}
          {can('payments', 'create') && (
            <Button size="sm" variant="secondary" onClick={() => setPayment({ direction: 'in' })} icon={<ArrowDownLeft className="h-4 w-4" />}>Receive Payment</Button>
          )}
        </div>
      </div>

      {isLoading || !o ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Tile
              label="Today's sales" value={inr(o.today.sales)} icon={IndianRupee}
              hint={`${plural(o.today.sales_count, 'bill')} · collected ${inr(o.today.collections)}`}
              href={docPath('sales_invoice')}
            />
            <Tile
              label="This month's sales" value={inr(o.month.sales)} icon={trend !== null && trend < 0 ? TrendingDown : TrendingUp} tone="green"
              hint={
                trend === null ? plural(o.month.sales_count, 'bill') : (
                  <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {trend >= 0 ? '+' : ''}{trend}% vs same days last month
                  </span>
                )
              }
              href="/reports"
            />
            <Tile
              label="To collect" value={inr(o.receivables.total)} icon={Wallet} tone="amber"
              hint={o.receivables.overdue > 0
                ? <span className="text-red-600">{inr(o.receivables.overdue)} overdue · {o.receivables.overdue_parties} parties</span>
                : 'Nothing overdue'}
              href="/outstanding"
            />
            <Tile
              label="To pay" value={inr(o.payables.total)} icon={ShoppingCart} tone="blue"
              hint={o.payables.overdue > 0 ? <span className="text-red-600">{inr(o.payables.overdue)} overdue</span> : 'Suppliers & binders'}
              href="/outstanding"
            />
            <Tile
              label="Purchases this month" value={inr(o.month.purchases)} icon={Package} tone="blue"
              hint={`${plural(o.month.purchase_count, 'bill')} · returns in ${inr(o.month.returns)}`}
              href={docPath('purchase_bill')}
            />
            <Tile
              label="Collections this month" value={inr(o.month.collections)} icon={ArrowDownLeft} tone="green"
              hint="Receipts + cash bills" href="/payments"
            />
            <Tile
              label="Stock value" value={inr(o.stock.value_at_cost)} icon={Package}
              tone={o.stock.out_count + o.stock.low_count > 0 ? 'amber' : 'primary'}
              hint={`${plural(o.stock.total_qty, 'copy', 'copies')} · ${o.stock.low_count} low · ${o.stock.out_count} out · ${o.stock.damaged_qty} damaged`}
              href="/stock"
            />
            <Tile
              label="Pending approvals" value={String(o.approvals.count)} icon={ShieldAlert} tone={o.approvals.count > 0 ? 'red' : 'primary'}
              hint={`Open: ${plural(o.open_documents.estimates.count, 'estimate')} · ${plural(o.open_documents.challans.count, 'challan')} · ${o.open_documents.binding_orders.count} binding`}
              href={`${docPath('sales_return')}?approval=pending`}
            />
          </div>

          {/* Chart + aging */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-text-1">Sales vs purchases · last 12 months</h3>
                <Link href="/reports" className="text-sm font-medium text-primary hover:underline">Reports</Link>
              </div>
              <SalesPurchaseChart data={o.chart.map((c) => ({ label: c.month, sales: c.sales, purchases: c.purchases }))} />
            </Card>
            <Panel title="Money to collect — by age" action={<Link href="/outstanding" className="text-xs font-medium text-primary hover:underline">Details</Link>}>
              <div className="px-5 pb-5 space-y-3">
                {AGING.map((a) => {
                  const v = o.receivables.buckets[a.key];
                  return (
                    <div key={a.key}>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-2">{a.label}</span>
                        <span className="font-medium text-text-1">{inr(v)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface dark:bg-border/40 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(v / agingMax) * 100}%`, background: 'var(--series-1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Collections & approvals */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Panel title="Overdue parties" action={<Link href="/outstanding" className="text-xs font-medium text-primary hover:underline">All</Link>}>
              {o.overdue_parties.length === 0 ? <Empty>No overdue payments.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.overdue_parties.map((p) => (
                    <li key={p.client_id ?? p.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        {p.client_id ? <Link href={`/clients/${p.client_id}?tab=ledger`} className="block truncate text-sm font-medium text-text-1 hover:text-primary">{p.name}</Link> : <span className="text-sm text-text-1">{p.name}</span>}
                        <p className="text-xs text-text-2">
                          <span className="font-medium text-red-600">{p.max_days_overdue} days late</span>
                          {p.credit_days ? ` · ${p.credit_days}-day credit` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-1">{inr(p.overdue_amount)}</span>
                        {p.phone && <a href={`tel:${p.phone}`} className="p-1.5 rounded text-text-2 hover:text-primary" aria-label={`Call ${p.name}`}><Phone className="h-4 w-4" /></a>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Due in the next 7 days">
              {o.due_soon.length === 0 ? <Empty>No credit bills due this week.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.due_soon.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <Link href={docPath('sales_invoice', d.id)} className="font-mono text-sm text-primary hover:underline">{d.invoice_number}</Link>
                        <p className="truncate text-xs text-text-2">{d.party_name} · {d.days_to_due === 0 ? 'due today' : `in ${d.days_to_due} days`}</p>
                      </div>
                      <span className="text-sm font-semibold text-text-1">{inr(d.balance)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Returns awaiting approval" action={<Link href={`${docPath('sales_return')}?approval=pending`} className="text-xs font-medium text-primary hover:underline">All</Link>}>
              {o.approvals.items.length === 0 ? <Empty>Nothing to approve.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.approvals.items.map((a) => (
                    <li key={a.id}>
                      <Link href={docPath(a.doc_type, a.id)} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface/60 dark:hover:bg-border/10">
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-text-1">{a.invoice_number}</p>
                          <p className="truncate text-xs text-text-2">{a.party_name ?? '—'} · {shortDate(a.issue_date)}</p>
                        </div>
                        <span className="text-sm font-semibold text-text-1">{inr(a.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Stock, dispatch, activity */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Panel title="Low & out of stock" action={<Link href="/stock" className="text-xs font-medium text-primary hover:underline">Stock</Link>}>
              {o.stock.low_items.length === 0 ? <Empty>All titles above their reorder level.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.stock.low_items.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-1">{s.book_title}</p>
                        <p className="text-xs text-text-2">{s.binding || '—'}{s.min_stock ? ` · reorder at ${s.min_stock}` : ''}</p>
                      </div>
                      <span className={cn('flex items-center gap-1 text-sm font-semibold', s.stock <= 0 ? 'text-red-600' : 'text-amber-600')}>
                        <AlertTriangle className="h-3.5 w-3.5" /> {s.stock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Shipments on the way">
              {o.in_transit.length === 0 ? <Empty>No dispatched shipments pending delivery.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.in_transit.map((t) => (
                    <li key={t.id}>
                      <Link href={docPath(t.doc_type, t.id)} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface/60 dark:hover:bg-border/10">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-1">{t.party_name ?? '—'} <span className="font-mono text-xs text-text-2">{t.invoice_number}</span></p>
                          <p className="truncate text-xs text-text-2">
                            {[t.carrier, t.tracking && `#${t.tracking}`, t.expected_delivery_date && `ETA ${shortDate(t.expected_delivery_date)}`].filter(Boolean).join(' · ') || 'No tracking details'}
                          </p>
                        </div>
                        <DeliveryBadge status={t.delivery_status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent activity" action={<ClipboardList className="h-4 w-4 text-text-2" />}>
              {o.recent.length === 0 ? <Empty>No documents yet — create your first sale.</Empty> : (
                <ul className="divide-y divide-border">
                  {o.recent.map((d) => (
                    <li key={d.id}>
                      <Link href={docPath(d.doc_type, d.id)} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface/60 dark:hover:bg-border/10">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-1">{docUi(d.doc_type).label} <span className="font-mono text-xs text-text-2">{d.invoice_number}</span></p>
                          <p className="truncate text-xs text-text-2">{d.party_name ?? (d.payment_mode === 'cash' ? 'Cash' : '—')} · {shortDate(d.issue_date)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold text-text-1">{inr(d.total)}</span>
                          <DocStatus doc={{ status: d.status, approval_status: d.approval_status, payment_mode: d.payment_mode, payment_status: null }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <PaymentDialog open={!!payment} onClose={() => setPayment(null)} defaults={payment ?? undefined} />
    </div>
  );
}
