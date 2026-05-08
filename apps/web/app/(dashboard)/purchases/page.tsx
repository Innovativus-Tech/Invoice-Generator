'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Plus, ShoppingCart, DollarSign, BarChart3, ChevronLeft, ChevronRight,
  X, Edit2, Trash2, MoreHorizontal,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePurchaseSummary, usePurchases, useNextOrderId,
  useCreatePurchase, useUpdatePurchase, useDeletePurchase,
} from '@/hooks/use-purchases';
import { usePermissions } from '@/hooks/use-permissions';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import type { PurchaseOrder, PurchaseFormValues, Client } from '@/types';

type PurchaseStatus = PurchaseFormValues['status'];

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatINR = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;

const formatINRCompact = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20',
  completed: 'bg-green-50 text-green-600 dark:bg-green-900/20',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-card border border-border rounded-lg shadow-lg p-3">
      <p className="text-xs text-text-2 mb-1">{label}</p>
      <p className="text-sm font-semibold text-text-1">
        ₹{new Intl.NumberFormat('en-IN').format(payload[0].value)}
      </p>
    </div>
  );
}

// ─── Purchase Drawer ──────────────────────────────────────────────────────────
function PurchaseDrawer({
  isOpen, onClose, editOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  editOrder: PurchaseOrder | null;
}) {
  const { data: nextOrderId } = useNextOrderId();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();

  const [useExistingClient, setUseExistingClient] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<PurchaseFormValues>({
    client_name: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'completed',
  });

  useEffect(() => {
    if (isOpen) {
      apiClient.get('/clients').then(r => setClients(r.data?.data || [])).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (editOrder) {
      setForm({
        client_id: editOrder.client_id || undefined,
        client_name: editOrder.client_name,
        item_name: editOrder.item_name,
        quantity: editOrder.quantity,
        unit_price: editOrder.unit_price,
        purchase_date: editOrder.purchase_date,
        notes: editOrder.notes || '',
        status: editOrder.status,
      });
      setUseExistingClient(!!editOrder.client_id);
    } else {
      setForm({
        client_name: '',
        item_name: '',
        quantity: 1,
        unit_price: 0,
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
        status: 'completed',
      });
      setUseExistingClient(false);
    }
  }, [editOrder, isOpen]);

  const totalAmount = form.quantity * form.unit_price;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name && !form.client_id) {
      toast.error('Please enter a vendor name or select a client');
      return;
    }
    if (!form.item_name) {
      toast.error('Item name is required');
      return;
    }

    if (editOrder) {
      updatePurchase.mutate({ ...form, id: editOrder.id }, { onSuccess: onClose });
    } else {
      createPurchase.mutate(form, { onSuccess: onClose });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-card border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-1">
                {editOrder ? 'Edit Purchase Order' : 'New Purchase Order'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg text-text-2 hover:bg-surface"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Order ID */}
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Order ID</label>
                <div className="px-3 py-2.5 rounded-lg bg-surface dark:bg-border/20 border border-border text-sm font-mono text-text-2">
                  {editOrder ? editOrder.order_id : (nextOrderId || 'Generating...')}
                </div>
              </div>

              {/* Client toggle */}
              <div>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setUseExistingClient(false)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                      !useExistingClient ? 'bg-primary text-white' : 'bg-surface text-text-2 hover:text-text-1'
                    }`}
                  >Enter vendor name</button>
                  <button type="button" onClick={() => setUseExistingClient(true)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                      useExistingClient ? 'bg-primary text-white' : 'bg-surface text-text-2 hover:text-text-1'
                    }`}
                  >Select existing client</button>
                </div>
                {useExistingClient ? (
                  <select
                    value={form.client_id || ''}
                    onChange={(e) => {
                      const c = clients.find(cl => cl.id === e.target.value);
                      setForm({ ...form, client_id: e.target.value, client_name: c?.name || '' });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-white dark:bg-card text-sm text-text-1 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <Input
                    label=""
                    placeholder="Vendor name"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value, client_id: undefined })}
                  />
                )}
              </div>

              <Input label="Item Name" value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Book title" />

              <div className="grid grid-cols-2 gap-4">
                <Input label="Quantity" type="number" value={String(form.quantity)}
                  onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
                <Input label="Unit Price ₹" type="number" value={String(form.unit_price)}
                  onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Total */}
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Total Amount</label>
                <div className="px-3 py-2.5 rounded-lg bg-surface dark:bg-border/20 border border-border text-sm font-semibold text-text-1">
                  {formatINR(totalAmount)}
                </div>
              </div>

              <Input label="Purchase Date" type="date" value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseStatus })}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-white dark:bg-card text-sm text-text-1 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-white dark:bg-card text-sm text-text-1 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="Any additional notes..."
                />
              </div>
            </form>

            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
                loading={createPurchase.isPending || updatePurchase.isPending}
              >
                {editOrder ? 'Update Purchase' : 'Save Purchase'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = usePurchaseSummary(month, year);
  const { data: listData, isLoading: listLoading } = usePurchases(month, year, page);
  const deletePurchase = useDeletePurchase();
  const { can } = usePermissions();

  const orders = listData?.data?.orders || [];
  const totalPages = listData?.data?.totalPages || 1;
  const purchaseTableColumns = can('purchases', 'update') || can('purchases', 'delete') ? 9 : 8;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get(`/purchases/export-pdf?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Purchase-Report-${monthLabels[month - 1]}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Purchase report downloaded');
    } catch {
      toast.error('Failed to export purchase report');
    } finally {
      setExporting(false);
    }
  };

  const openAdd = () => { setEditOrder(null); setDrawerOpen(true); };
  const openEdit = (order: PurchaseOrder) => { setEditOrder(order); setDrawerOpen(true); setActionMenuId(null); };
  const handleDelete = (id: string) => { deletePurchase.mutate(id); setActionMenuId(null); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Purchases" description="Track your expenses and purchase orders" />
        <div className="flex gap-2">
          {can('purchases', 'create') && <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add Purchase</Button>}
          <Button variant="secondary" onClick={handleExportPdf} loading={exporting} icon={<Download className="h-4 w-4" />}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Month/Year Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-card border border-border rounded-xl p-1 overflow-x-auto">
          {monthLabels.map((m, i) => (
            <button
              key={m}
              onClick={() => { setMonth(i + 1); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                month === i + 1
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-2 hover:text-text-1 hover:bg-surface dark:hover:bg-border/30'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface border border-border">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm font-semibold text-text-1 min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface border border-border">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Total Spent</span>
              <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{formatINR(summary?.total_spent || 0)}</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Orders</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{summary?.order_count || 0}</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-2 uppercase tracking-wide">Average Order</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-1">{formatINR(summary?.average_order_value || 0)}</p>
          </Card>
        </motion.div>
      )}

      {/* Spending Chart */}
      <Card>
        <div className="p-5 pb-0">
          <h3 className="text-base font-semibold text-text-1">Spending Trend (Last 12 Months)</h3>
        </div>
        <div className="h-64 w-full p-4">
          {summaryLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.monthly_breakdown || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B6880' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6880' }} tickLine={false} axisLine={false} tickFormatter={formatINRCompact} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" fill="#6C63FF" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top Vendors */}
      <Card>
        <div className="p-5 pb-3">
          <h3 className="text-base font-semibold text-text-1">Top Vendors This Month</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-border">
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5 w-12">Rank</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Vendor</th>
                <th className="text-center text-xs font-medium text-text-2 uppercase py-3 px-5">Orders</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {summaryLoading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan={4} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : summary?.top_vendors && summary.top_vendors.length > 0 ? (
                summary.top_vendors.map((v, i) => {
                  const badgeColors = ['bg-yellow-100 text-yellow-700', 'bg-gray-100 text-gray-600', 'bg-orange-100 text-orange-700'];
                  return (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${badgeColors[i] || 'bg-gray-50 text-gray-500'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-sm font-medium text-text-1">{v.client_name}</td>
                      <td className="py-3 px-5 text-sm text-text-2 text-center">{v.order_count}</td>
                      <td className="py-3 px-5 text-sm font-semibold text-text-1 text-right">{formatINR(v.total)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-text-2">No vendor data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <div className="p-5 pb-3">
          <h3 className="text-base font-semibold text-text-1">Purchase Orders — {monthLabels[month - 1]} {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-border">
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Order ID</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Vendor</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Item</th>
                <th className="text-center text-xs font-medium text-text-2 uppercase py-3 px-5">Qty</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Unit ₹</th>
                <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5">Total</th>
                <th className="text-left text-xs font-medium text-text-2 uppercase py-3 px-5">Date</th>
                <th className="text-center text-xs font-medium text-text-2 uppercase py-3 px-5">Status</th>
                {(can('purchases', 'update') || can('purchases', 'delete')) && (
                  <th className="text-right text-xs font-medium text-text-2 uppercase py-3 px-5 w-12"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                [1,2,3].map(i => <tr key={i}><td colSpan={purchaseTableColumns} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : orders.length > 0 ? (
                orders.map((o: PurchaseOrder) => (
                  <tr key={o.id} className="border-b border-border hover:bg-surface dark:hover:bg-border/20 transition-colors">
                    <td className="py-3 px-5 text-sm font-mono font-medium text-primary">{o.order_id}</td>
                    <td className="py-3 px-5 text-sm text-text-1">{o.client_name}</td>
                    <td className="py-3 px-5 text-sm text-text-2 max-w-[150px] truncate">{o.item_name}</td>
                    <td className="py-3 px-5 text-sm text-text-2 text-center">{o.quantity}</td>
                    <td className="py-3 px-5 text-sm text-text-2 text-right">{formatINR(o.unit_price)}</td>
                    <td className="py-3 px-5 text-sm font-semibold text-text-1 text-right">{formatINR(o.total_amount)}</td>
                    <td className="py-3 px-5 text-sm text-text-2">{new Date(o.purchase_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status] || ''}`}>
                        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      </span>
                    </td>
                    {(can('purchases', 'update') || can('purchases', 'delete')) && (
                      <td className="py-3 px-5 text-right relative">
                        <button onClick={() => setActionMenuId(actionMenuId === o.id ? null : o.id)}
                          className="p-1.5 rounded-lg text-text-2 hover:bg-surface"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {actionMenuId === o.id && (
                          <div className="absolute right-5 top-10 z-20 w-32 bg-white dark:bg-card border border-border rounded-lg shadow-lg py-1">
                            {can('purchases', 'update') && (
                              <button onClick={() => openEdit(o)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-1 hover:bg-surface"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> Edit
                              </button>
                            )}
                            {can('purchases', 'delete') && (
                              <button onClick={() => handleDelete(o.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={purchaseTableColumns} className="py-12 text-center text-sm text-text-2">No purchase orders for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-text-2">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface disabled:opacity-40"
              >Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </Card>

      {/* Drawer */}
      <PurchaseDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} editOrder={editOrder} />
    </div>
  );
}
