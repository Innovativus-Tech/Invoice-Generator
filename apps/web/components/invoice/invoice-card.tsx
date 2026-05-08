'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

interface InvoiceCardProps {
  invoice: Invoice;
  onClick?: () => void;
}

export function InvoiceCard({ invoice, onClick }: InvoiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card hover onClick={onClick} className="group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-text-1">
                {invoice.invoice_number}
              </p>
              <p className="text-xs text-text-2">
                {invoice.clients?.name || 'No client'}
              </p>
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-text-2">{invoice.order_id ? `Order: ${invoice.order_id}` : formatDate(invoice.issue_date)}</p>
          </div>
          <p className="text-lg font-semibold text-text-1">
            {formatCurrency(Number(invoice.total), invoice.currency)}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-text-2">
            Created {formatDate(invoice.created_at)}
          </span>
          <ExternalLink className="h-4 w-4 text-text-2" />
        </div>
      </Card>
    </motion.div>
  );
}
