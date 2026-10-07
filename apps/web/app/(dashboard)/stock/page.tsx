'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, History, PackageCheck, PackageX, Search, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdjustStock, useStockMovements, useStockSummary } from '@/hooks/use-stock';
import { useDebounce } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';
import { docPath, docUi } from '@/lib/doc-types';
import { cn, downloadCsv, inr, shortDate } from '@/lib/utils';
import type { DocType, StockFilter, StockRow } from '@/types';

const FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out of stock' },
  { value: 'damaged', label: 'Damaged' },
];

function movementLabel(type: string) {
  if (type === 'opening') return 'Opening stock';
  if (type === 'adjustment') return 'Adjustment';
  return docUi(type as DocType)?.label ?? type;
}

export default function StockPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [filter, setFilter] = useState<StockFilter>('all');
  const [search, setSearch] = useState('');
  const [binding, setBinding] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useStockSummary({ filter, search: debounced || undefined, binding: binding || undefined, page });
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [history, setHistory] = useState<StockRow | null>(null);

  const totals = data?.totals;
  const exportCsv = () =>
    downloadCsv('Stock.csv', [
      ['Title', 'ISBN', 'Binding', 'Stock', 'Damaged', 'Reorder level', 'Purchase rate', 'Price', 'Stock value'],
      ...(data?.items ?? []).map((r) => [r.book_title, r.isbn, r.binding, r.stock, r.damaged_stock, r.min_stock, r.purchase_rate, r.price, r.stock_value]),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Stock" description="What is in stock, what is running low, and damaged copies set aside">
        <Button variant="secondary" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>CSV</Button>
        <Button variant="secondary" onClick={() => router.push('/inventory')}>Manage items</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Titles</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{totals?.item_count ?? '—'}</p>
          <p className="text-xs text-text-2 mt-1">{totals?.total_qty ?? 0} copies in stock</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-text-2 uppercase tracking-wide">Stock value (cost)</p>
          <p className="text-2xl font-bold text-text-1 mt-1">{inr(totals?.value_at_cost ?? 0)}</p>
          <p className="text-xs text-text-2 mt-1">at MRP {inr(totals?.value_at_price ?? 0)}</p>
        </Card>
        <button onClick={() => { setFilter('low'); setPage(1); }} className="text-left">
          <Card className="!p-4 h-full" hover>
            <p className="text-xs text-text-2 uppercase tracking-wide">Low stock</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totals?.low_count ?? 0}</p>
            <p className="text-xs text-text-2 mt-1">at or below reorder level</p>
          </Card>
        </button>
        <button onClick={() => { setFilter('out'); setPage(1); }} className="text-left">
          <Card className="!p-4 h-full" hover>
            <p className="text-xs text-text-2 uppercase tracking-wide">Out of stock</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{totals?.out_count ?? 0}</p>
            <p className="text-xs text-text-2 mt-1">zero or negative</p>
          </Card>
        </button>
        <button onClick={() => { setFilter('damaged'); setPage(1); }} className="text-left">
          <Card className="!p-4 h-full" hover>
            <p className="text-xs text-text-2 uppercase tracking-wide">Damaged copies</p>
            <p className="text-2xl font-bold text-text-1 mt-1">{totals?.total_damaged ?? 0}</p>
            <p className="text-xs text-text-2 mt-1">{totals?.damaged_count ?? 0} titles · not for sale</p>
          </Card>
        </button>
      </div>

      <Card padding={false} className="p-4">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search title, ISBN, author…"
              className="w-full h-10 rounded-md border border-border bg-white pl-9 pr-3 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card"
            />
          </div>
          <select
            value={binding}
            onChange={(e) => { setBinding(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 dark:bg-card xl:w-44"
            aria-label="Binding"
          >
            <option value="">All bindings</option>
            {(data?.bindings ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <Segmented<StockFilter> ariaLabel="Filter" value={filter} onChange={(f) => { setFilter(f); setPage(1); }} options={FILTERS} />
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Binding</th>
                <th className="px-4 py-3 text-right">In stock</th>
                <th className="px-4 py-3 text-right">Damaged</th>
                <th className="px-4 py-3 text-right">Reorder at</th>
                <th className="px-4 py-3 text-right">Purchase rate</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : (data?.items ?? []).length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-14 text-center text-text-2">No titles match</td></tr>
              ) : data!.items.map((r) => (
                <tr key={r.id} className="hover:bg-surface/50 dark:hover:bg-border/10">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-1">{r.book_title}</p>
                    <p className="text-xs text-text-2">{[r.isbn, r.author].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="px-4 py-3 text-text-2">{r.binding || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('inline-flex items-center gap-1 font-semibold', r.status === 'out' ? 'text-red-600' : r.status === 'low' ? 'text-amber-600' : 'text-text-1')}>
                      {r.status !== 'ok' && <AlertTriangle className="h-3.5 w-3.5" />}
                      {r.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{r.damaged_stock > 0 ? <span className="text-red-500">{r.damaged_stock}</span> : <span className="text-text-2">—</span>}</td>
                  <td className="px-4 py-3 text-right text-text-2">{r.min_stock || '—'}</td>
                  <td className="px-4 py-3 text-right text-text-2">{r.purchase_rate ? inr(r.purchase_rate) : '—'}</td>
                  <td className="px-4 py-3 text-right text-text-2">{r.price ? inr(r.price) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-text-1">{r.stock_value ? inr(r.stock_value) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setHistory(r)} className="p-1.5 rounded text-text-2 hover:text-primary hover:bg-primary/10" title="Stock history" aria-label="Stock history">
                        <History className="h-4 w-4" />
                      </button>
                      {can('inventory', 'update') && (
                        <button onClick={() => setAdjusting(r)} className="p-1.5 rounded text-text-2 hover:text-primary hover:bg-primary/10" title="Adjust stock" aria-label="Adjust stock">
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-text-2">Page {page} of {data?.totalPages} · {data?.total} titles</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />
      <HistoryDrawer row={history} onClose={() => setHistory(null)} />
    </div>
  );
}

function AdjustDialog({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  const adjust = useAdjustStock();
  const [kind, setKind] = useState<'add' | 'remove' | 'damage' | 'writeoff'>('add');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (row) { setKind('add'); setQty(1); setReason(''); }
  }, [row]);

  if (!row) return null;
  // add: +stock · remove: −stock · damage: stock → damaged · writeoff: remove damaged copies
  const change = {
    add: { qty_change: qty, damaged_change: 0 },
    remove: { qty_change: -qty, damaged_change: 0 },
    damage: { qty_change: -qty, damaged_change: qty },
    writeoff: { qty_change: 0, damaged_change: -qty },
  }[kind];

  return (
    <Dialog open={!!row} onClose={onClose} title={`Adjust stock · ${row.book_title}`} description={`In stock ${row.stock} · damaged ${row.damaged_stock}`}>
      <div className="space-y-4">
        <Segmented
          size="sm"
          ariaLabel="Adjustment"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'add', label: 'Add', icon: <PackageCheck className="h-3.5 w-3.5" /> },
            { value: 'remove', label: 'Remove' },
            { value: 'damage', label: 'Mark damaged' },
            { value: 'writeoff', label: 'Write off damaged', icon: <PackageX className="h-3.5 w-3.5" /> },
          ]}
          className="flex-wrap"
        />
        <Input label="Quantity" type="number" min={1} value={String(qty)} onChange={(e) => setQty(Math.max(parseInt(e.target.value, 10) || 0, 0))} />
        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Physical count, water damage, sample copies" />
        <p className="text-xs text-text-2">
          After saving: in stock {row.stock + change.qty_change}, damaged {row.damaged_stock + change.damaged_change}.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!qty || !reason.trim()}
            loading={adjust.isPending}
            onClick={() => adjust.mutate({ itemId: row.id, ...change, reason: reason.trim() }, { onSuccess: onClose })}
          >
            Save adjustment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function HistoryDrawer({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStockMovements({ item_id: row?.id, page }, !!row);
  React.useEffect(() => setPage(1), [row?.id]);

  return (
    <AnimatePresence>
      {row && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-card border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-text-1">Stock history</h2>
                <p className="text-sm text-text-2">{row.book_title} · now {row.stock} in stock{row.damaged_stock ? `, ${row.damaged_stock} damaged` : ''}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-card">
                  <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Entry</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Damaged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
                  ) : (data?.movements ?? []).length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-text-2">No movements yet</td></tr>
                  ) : data!.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{shortDate(m.date)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-text-1">
                          {movementLabel(m.doc_type)}{' '}
                          {m.doc_id && m.doc_number && !['opening', 'adjustment'].includes(m.doc_type) && (
                            <Link href={docPath(m.doc_type as DocType, m.doc_id)} className="font-mono text-xs text-primary hover:underline">{m.doc_number}</Link>
                          )}
                        </p>
                        <p className="text-xs text-text-2">{[m.party_name, ['opening', 'adjustment'].includes(m.doc_type) ? m.reason : null].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-medium', m.qty_change > 0 ? 'text-green-600' : m.qty_change < 0 ? 'text-red-600' : 'text-text-2')}>
                        {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change || '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right', m.damaged_change ? 'text-red-500' : 'text-text-2')}>
                        {m.damaged_change > 0 ? `+${m.damaged_change}` : m.damaged_change || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data?.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <span className="text-xs text-text-2">Page {page} of {data?.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
                  <Button variant="secondary" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Older</Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
