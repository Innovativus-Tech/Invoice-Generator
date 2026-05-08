'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mail } from 'lucide-react';
import type { Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface SendDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSend: (invoiceId: string) => Promise<void>;
}

export function SendDialog({ open, onClose, invoice, onSend }: SendDialogProps) {
  const [sending, setSending] = useState(false);

  if (!invoice) return null;

  const clientEmail = invoice.clients?.email || '';

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(invoice.id);
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send Invoice"
      description={`Send invoice ${invoice.invoice_number} to client`}
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-surface dark:bg-[#0F0E17] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-1">
                {invoice.invoice_number}
              </p>
              <p className="text-xs text-text-2">{invoice.clients?.name}</p>
            </div>
            <p className="text-lg font-semibold text-text-1">
              {formatCurrency(Number(invoice.total), invoice.currency)}
            </p>
          </div>
        </div>

        <Input
          label="Recipient Email"
          value={clientEmail}
          readOnly
          icon={<Mail className="h-4 w-4" />}
        />

        {!clientEmail && (
          <p className="text-sm text-danger">
            This client has no email address. Please add one in the client settings.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            loading={sending}
            disabled={!clientEmail}
            icon={<Send className="h-4 w-4" />}
          >
            Send Invoice
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
