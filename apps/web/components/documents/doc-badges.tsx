'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/invoice/status-badge';
import { APPROVAL_STATUS, DELIVERY_STATUS } from '@/lib/doc-types';
import { cn } from '@/lib/utils';
import type { ApprovalStatus, BillingDocument, DeliveryStatus, PaymentStatus } from '@/types';

export function ApprovalBadge({ status }: { status: ApprovalStatus | null | undefined }) {
  if (!status) return null;
  const cfg = APPROVAL_STATUS[status];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const cfg = DELIVERY_STATUS[status];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  partial: { label: 'Part paid', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  unpaid: { label: 'Unpaid', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export function PaymentBadge({ status }: { status: PaymentStatus | null | undefined }) {
  if (!status) return null;
  const cfg = PAYMENT_STATUS[status];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

/** "45 days overdue" / "due in 3 days" pill. */
export function DueBadge({ daysOverdue, daysToDue, className }: { daysOverdue: number; daysToDue?: number; className?: string }) {
  if (daysOverdue > 0) {
    return (
      <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', daysOverdue > 60 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', className)}>
        {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
      </span>
    );
  }
  if (daysToDue === undefined) return null;
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', daysToDue <= 3 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', className)}>
      {daysToDue === 0 ? 'Due today' : `Due in ${daysToDue} ${daysToDue === 1 ? 'day' : 'days'}`}
    </span>
  );
}

/** The most useful status for a document row: approval for returns, payment for bills, else lifecycle. */
export function DocStatus({ doc }: { doc: Pick<BillingDocument, 'status' | 'approval_status' | 'payment_status' | 'payment_mode'> }) {
  if (doc.status === 'cancelled' || doc.status === 'converted') return <StatusBadge status={doc.status} />;
  if (doc.approval_status) return <ApprovalBadge status={doc.approval_status} />;
  if (doc.payment_status) {
    return doc.payment_mode === 'cash'
      ? <Badge className="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">Cash</Badge>
      : <PaymentBadge status={doc.payment_status} />;
  }
  return <StatusBadge status={doc.status} />;
}
