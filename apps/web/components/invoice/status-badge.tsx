'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { statusConfig } from '@/lib/utils';
import type { InvoiceStatus } from '@/types';

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge className={config.className + (className ? ' ' + className : '')} dot dotColor={config.dotColor}>
      {config.label}
    </Badge>
  );
}
