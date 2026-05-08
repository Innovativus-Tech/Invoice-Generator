'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className }: TableProps) {
  return (
    <thead className={cn('border-b border-border', className)}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn('divide-y divide-border', className)}>{children}</tbody>;
}

export function TableRow({ children, className, onClick, hover = true }: TableProps & { onClick?: () => void; hover?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        hover && 'hover:bg-surface/50 dark:hover:bg-card/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className }: TableProps) {
  return (
    <th className={cn('h-11 px-4 text-left text-xs font-medium text-text-2 uppercase tracking-wider', className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }: TableProps) {
  return (
    <td className={cn('px-4 py-3 text-text-1', className)}>
      {children}
    </td>
  );
}
