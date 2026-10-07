'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRightLeft, CheckCircle, Clock, Download, Edit, IndianRupee, Link2, MoreHorizontal, RotateCcw,
  Send, ShieldAlert, ShieldCheck, Trash2, Truck, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { ApprovalBadge, DeliveryBadge, DocStatus, DueBadge } from './doc-badges';
import { DocumentPreview } from './document-preview';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import {
  useApproval, useDeleteDocument, useDocument, useDownloadDocumentPdf, useSendDocument, useUpdateDelivery, useUpdateDocumentStatus,
} from '@/hooks/use-documents';
import { useClients } from '@/hooks/use-clients';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { DELIVERY_STATUS, PAYMENT_METHOD_LABEL, docPath, docUi, newDocPath } from '@/lib/doc-types';
import { documentToFormValues } from '@/lib/document-defaults';
import { daysUntil, formatRelativeDate, inr, shortDate, todayISO } from '@/lib/utils';
import type { DeliveryStatus, DocType } from '@/types';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-2">{label}</span>
      <span className="text-right text-text-1">{children}</span>
    </div>
  );
}

export function DocumentDetailPage({ type, id }: { type: DocType; id: string }) {
  const router = useRouter();
  const { can } = usePermissions();
  const { data: doc, isLoading } = useDocument(id);
  const { data: settings } = useSettings();
  const { data: parties } = useClients();
  const setStatus = useUpdateDocumentStatus();
  const approval = useApproval();
  const deleteDoc = useDeleteDocument();
  const download = useDownloadDocumentPdf();
  const send = useSendDocument();
  const delivery = useUpdateDelivery();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Links like /invoices/:id resolve to the right page for every document type.
  const wrongType = !!doc && doc.doc_type !== type;
  useEffect(() => {
    if (doc && wrongType) router.replace(docPath(doc.doc_type, doc.id));
  }, [doc, wrongType, router]);

  if (isLoading || wrongType) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-border/40 animate-pulse rounded-lg" />
        <div className="h-[600px] bg-border/40 animate-pulse rounded-xl" />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-text-1">Document not found</h2>
        <Button variant="secondary" onClick={() => router.push(docPath(type))} className="mt-4">Back</Button>
      </div>
    );
  }
  const ui = docUi(type);
  const party = parties?.find((p) => p.id === doc.client_id) ?? null;
  const canUpdate = can(ui.resource, 'update');
  const canApprove = can('approvals', 'approve');
  const isCancelled = doc.status === 'cancelled';
  const closed = isCancelled || (doc.status === 'converted' && ['estimate', 'delivery_challan', 'binding_order'].includes(type));
  const conversions = ui.convertsTo.filter((t) => can(docUi(t).resource, 'create') && !closed);
  const fileName = `${ui.label}-${doc.invoice_number}`;

  const moreItems = [
    ui.isBill && doc.payment_status !== 'paid' && !isCancelled && canUpdate
      ? { label: 'Mark as fully paid', icon: <CheckCircle className="h-4 w-4" />, onClick: () => setStatus.mutate({ id, status: 'paid' }) }
      : null,
    canUpdate && !isCancelled && doc.status !== 'converted'
      ? { label: 'Cancel document', icon: <XCircle className="h-4 w-4" />, onClick: () => { if (confirm('Cancel this document? Its stock and ledger effect is reversed.')) setStatus.mutate({ id, status: 'cancelled' }); } }
      : null,
    canUpdate && isCancelled
      ? { label: 'Restore', icon: <RotateCcw className="h-4 w-4" />, onClick: () => setStatus.mutate({ id, status: 'draft' }) }
      : null,
    can(ui.resource, 'delete') ? { separator: true, label: '' } : null,
    can(ui.resource, 'delete')
      ? { label: 'Delete permanently', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => { if (confirm(`Delete ${doc.invoice_number}? This cannot be undone.`)) deleteDoc.mutate(id, { onSuccess: () => router.push(docPath(type)) }); } }
      : null,
  ].filter(Boolean) as { label: string; icon?: React.ReactNode; onClick?: () => void; danger?: boolean; separator?: boolean }[];

  const timeline = [
    { label: 'Created', date: doc.created_at, icon: Clock, done: true },
    ...(doc.approval_status ? [{ label: doc.approval_status === 'pending' ? 'Awaiting approval' : doc.approval_status === 'approved' ? 'Approved' : 'Rejected', date: doc.approved_at, icon: doc.approval_status === 'rejected' ? ShieldAlert : ShieldCheck, done: doc.approval_status !== 'pending' }] : []),
    ...(doc.sent_at ? [{ label: 'Sent', date: doc.sent_at, icon: Send, done: true }] : []),
    ...(doc.dispatch_date ? [{ label: 'Dispatched', date: doc.dispatch_date, icon: Truck, done: true }] : []),
    ...(doc.delivered_date ? [{ label: 'Delivered', date: doc.delivered_date, icon: CheckCircle, done: true }] : []),
    ...(ui.isBill ? [{ label: 'Paid', date: doc.paid_at, icon: IndianRupee, done: doc.payment_status === 'paid' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push(docPath(type))} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-2">{ui.label}</span>
              <DocStatus doc={doc} />
              {doc.dispatch_mode !== 'none' && <DeliveryBadge status={doc.delivery_status} />}
            </div>
            <h1 className="text-2xl font-semibold text-text-1 font-mono truncate">{doc.invoice_number}</h1>
            <p className="text-sm text-text-2">
              {doc.clients?.name ?? doc.party_name ?? (doc.payment_mode === 'cash' ? 'Cash' : '—')} · {inr(doc.total)} · {shortDate(doc.issue_date)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => download.mutate({ id, fileName })} loading={download.isPending} icon={<Download className="h-4 w-4" />}>PDF</Button>
          {can(ui.resource, 'send') && !isCancelled && (
            <Button variant="secondary" size="sm" onClick={() => { if (!doc.clients?.email) { toast.error('Add an email address to this party first.'); return; } send.mutate(id); }} loading={send.isPending} icon={<Send className="h-4 w-4" />}>Email</Button>
          )}
          {ui.isBill && doc.payment_mode === 'credit' && doc.balance_due > 0 && !isCancelled && can('payments', 'create') && (
            <Button size="sm" onClick={() => setPaymentOpen(true)} icon={<IndianRupee className="h-4 w-4" />}>
              {ui.side === 'sales' ? 'Receive payment' : 'Make payment'}
            </Button>
          )}
          {conversions.length === 1 && (
            <Button variant="outline" size="sm" onClick={() => router.push(newDocPath(conversions[0], { from: id }))} icon={<ArrowRightLeft className="h-4 w-4" />}>
              Make {docUi(conversions[0]).label}
            </Button>
          )}
          {conversions.length > 1 && (
            <DropdownMenu
              trigger={<Button variant="outline" size="sm" icon={<ArrowRightLeft className="h-4 w-4" />}>Convert</Button>}
              items={conversions.map((t) => ({ label: `Make ${docUi(t).label}`, onClick: () => router.push(newDocPath(t, { from: id })) }))}
            />
          )}
          {canUpdate && !isCancelled && (
            <Button variant="ghost" size="sm" onClick={() => router.push(docPath(type, id, 'edit'))} icon={<Edit className="h-4 w-4" />}>Edit</Button>
          )}
          {moreItems.length > 0 && (
            <DropdownMenu trigger={<Button variant="ghost" size="sm" aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button>} items={moreItems} />
          )}
        </div>
      </div>

      {/* Approval banner */}
      {doc.approval_status === 'pending' && !isCancelled && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium">Waiting for approval</p>
            <p className="text-xs opacity-80">Stock comes back and the party is credited only after an owner or admin approves this return.</p>
          </div>
          {canApprove && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRejectOpen(true)} icon={<XCircle className="h-4 w-4" />}>Reject</Button>
              <Button size="sm" onClick={() => approval.mutate({ id, decision: 'approve' })} loading={approval.isPending} icon={<ShieldCheck className="h-4 w-4" />}>Approve</Button>
            </div>
          )}
        </div>
      )}
      {doc.approval_status === 'rejected' && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">Rejected{doc.rejection_reason ? `: ${doc.rejection_reason}` : ''}. Edit and save to send it for approval again.</span>
          {canApprove && <Button size="sm" variant="secondary" onClick={() => approval.mutate({ id, decision: 'approve' })}>Approve anyway</Button>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DocumentPreview
            type={type}
            formData={documentToFormValues(doc)}
            profile={settings}
            party={party}
            sourceNumber={doc.source_doc?.invoice_number}
            amountPaid={doc.amount_paid}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">Summary</h3>
            <div className="space-y-3">
              <InfoRow label={ui.partyLabel}>
                {doc.client_id ? (
                  <Link href={`/clients/${doc.client_id}`} className="font-medium text-primary hover:underline">{doc.clients?.name ?? doc.party_name}</Link>
                ) : (doc.party_name ?? '—')}
              </InfoRow>
              {(doc.party_phone || doc.clients?.phone) && <InfoRow label="Phone">{doc.party_phone || doc.clients?.phone}</InfoRow>}
              {ui.isBill && <InfoRow label="Bill type">{doc.payment_mode === 'cash' ? 'Cash' : `Credit · ${doc.credit_days} days`}</InfoRow>}
              {doc.party_ref_number && <InfoRow label="Supplier bill no.">{doc.party_ref_number}</InfoRow>}
              {doc.reason && <InfoRow label="Reason">{doc.reason}</InfoRow>}
              <div className="border-t border-border pt-3 space-y-2">
                <InfoRow label="Subtotal">{inr(doc.subtotal)}</InfoRow>
                {doc.discount_amount > 0 && <InfoRow label="Extra discount">− {inr(doc.discount_amount)}</InfoRow>}
                {doc.tax_amount > 0 && <InfoRow label="GST">{inr(doc.tax_amount)}</InfoRow>}
                {doc.postage_charge > 0 && <InfoRow label="Postage / delivery">{inr(doc.postage_charge)}</InfoRow>}
                {doc.other_charges > 0 && <InfoRow label={doc.other_charges_label || 'Other charges'}>{inr(doc.other_charges)}</InfoRow>}
                {doc.round_off !== 0 && <InfoRow label="Round off">{inr(doc.round_off)}</InfoRow>}
                <InfoRow label="Total"><span className="text-base font-semibold text-primary">{inr(doc.total)}</span></InfoRow>
              </div>
              {ui.isBill && doc.payment_mode === 'credit' && !isCancelled && (
                <div className="border-t border-border pt-3 space-y-2">
                  <InfoRow label={ui.side === 'sales' ? 'Received' : 'Paid'}><span className="text-green-600">{inr(doc.amount_paid)}</span></InfoRow>
                  <InfoRow label="Balance"><span className="font-semibold text-amber-600">{inr(doc.balance_due)}</span></InfoRow>
                  {doc.due_date && (
                    <InfoRow label="Due date">
                      <span className="flex flex-col items-end gap-1">
                        {shortDate(doc.due_date)}
                        {doc.balance_due > 0 && <DueBadge daysOverdue={doc.days_overdue} daysToDue={Math.max(0, daysUntil(doc.due_date))} />}
                      </span>
                    </InfoRow>
                  )}
                </div>
              )}
            </div>
          </Card>

          {ui.isBill && (doc.payments?.length ?? 0) > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-3">Payments against this bill</h3>
              <div className="divide-y divide-border">
                {doc.payments!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="text-text-1">{shortDate(p.payment_date)} · {PAYMENT_METHOD_LABEL[p.mode]}</p>
                      <p className="text-xs text-text-2">{[p.payment_number, p.reference].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className="font-medium text-green-600">{inr(p.amount)}</span>
                  </div>
                ))}
              </div>
              {doc.amount_paid > (doc.payments ?? []).reduce((s, p) => s + p.amount, 0) + 0.005 && (
                <p className="mt-2 text-xs text-text-2">Also settled by returns, notes or on-account payments (oldest bills first).</p>
              )}
            </Card>
          )}

          {(doc.dispatch_mode !== 'none' || ui.showDispatch) && type !== 'binding_order' && (
            <Card>
              <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-3">Delivery</h3>
              {doc.dispatch_mode === 'none' ? (
                <p className="text-sm text-text-2">Not dispatched. {canUpdate && <Link href={docPath(type, id, 'edit')} className="text-primary hover:underline">Add courier / transport details</Link>}</p>
              ) : (
                <div className="space-y-2">
                  {doc.dispatch_mode === 'courier' && (
                    <>
                      <InfoRow label="Courier">{doc.courier_name || '—'}</InfoRow>
                      <InfoRow label="Tracking no."><span className="font-mono">{doc.tracking_number || '—'}</span></InfoRow>
                    </>
                  )}
                  {doc.dispatch_mode === 'transport' && (
                    <>
                      <InfoRow label="Transport">{doc.transport_name || '—'}</InfoRow>
                      <InfoRow label="LR / GR no."><span className="font-mono">{doc.lr_number || '—'}</span></InfoRow>
                      {doc.vehicle_number && <InfoRow label="Vehicle">{doc.vehicle_number}</InfoRow>}
                      {doc.cartons != null && <InfoRow label="Cartons">{doc.cartons}</InfoRow>}
                      {doc.freight_type && <InfoRow label="Freight">{doc.freight_type === 'paid' ? 'Paid' : 'To pay (unpaid)'}</InfoRow>}
                      {doc.delivery_type && <InfoRow label="Delivery">{doc.delivery_type === 'door' ? 'Door delivery' : 'Godown delivery'}</InfoRow>}
                      {doc.transport_details && <InfoRow label="Details">{doc.transport_details}</InfoRow>}
                    </>
                  )}
                  {doc.dispatch_mode === 'hand' && <InfoRow label="Mode">By hand</InfoRow>}
                  <InfoRow label="Dispatched">{shortDate(doc.dispatch_date)}</InfoRow>
                  <InfoRow label="Expected">{shortDate(doc.expected_delivery_date)}</InfoRow>
                  <InfoRow label="Delivered">{shortDate(doc.delivered_date)}</InfoRow>
                  {canUpdate && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <select
                        value={doc.delivery_status}
                        onChange={(e) => delivery.mutate({ id, delivery_status: e.target.value as DeliveryStatus })}
                        className="flex-1 min-w-[140px] h-9 rounded-md border border-border bg-white px-2 text-sm text-text-1 dark:bg-card"
                        aria-label="Delivery status"
                      >
                        {(Object.keys(DELIVERY_STATUS) as DeliveryStatus[]).map((s) => <option key={s} value={s}>{DELIVERY_STATUS[s].label}</option>)}
                      </select>
                      {doc.delivery_status !== 'delivered' && (
                        <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => delivery.mutate({ id, delivery_status: 'delivered', delivered_date: todayISO() })}>Delivered today</Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {(doc.source_doc || (doc.derived_docs?.length ?? 0) > 0) && (
            <Card>
              <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-3">Linked documents</h3>
              <div className="space-y-2">
                {doc.source_doc && (
                  <Link href={docPath(doc.source_doc.doc_type, doc.source_doc.id)} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm hover:text-primary">
                    <Link2 className="h-4 w-4 text-text-2" />
                    <span className="text-text-2">From {docUi(doc.source_doc.doc_type).label}</span>
                    <span className="font-mono whitespace-nowrap">{doc.source_doc.invoice_number}</span>
                  </Link>
                )}
                {doc.derived_docs?.map((d) => (
                  <Link key={d.id} href={docPath(d.doc_type, d.id)} className="flex items-center justify-between gap-2 text-sm hover:text-primary">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <ArrowRightLeft className="h-4 w-4 text-text-2" />
                      {docUi(d.doc_type).label} <span className="font-mono whitespace-nowrap">{d.invoice_number}</span>
                    </span>
                    {d.approval_status ? <ApprovalBadge status={d.approval_status} /> : <span className="text-text-2">{inr(d.total)}</span>}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">Timeline</h3>
            <div className="space-y-4">
              {timeline.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-primary/10 text-primary' : 'bg-surface text-text-2 dark:bg-border/30'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${step.done ? 'text-text-1' : 'text-text-2'}`}>{step.label}</p>
                      {step.date && <p className="text-xs text-text-2 mt-0.5">{shortDate(step.date)} · {formatRelativeDate(step.date)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        lockParty={!!doc.client_id}
        defaults={{
          direction: ui.side === 'sales' ? 'in' : 'out',
          client_id: doc.client_id ?? '',
          invoice_id: doc.id,
          amount: doc.balance_due,
        }}
      />

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject return" description="The return stays on record but has no effect on stock or the party's balance.">
        <textarea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason (shown to the person who created it)"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card"
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!rejectReason.trim()}
            loading={approval.isPending}
            onClick={() => approval.mutate({ id, decision: 'reject', reason: rejectReason.trim() }, { onSuccess: () => { setRejectOpen(false); setRejectReason(''); } })}
          >
            Reject return
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
