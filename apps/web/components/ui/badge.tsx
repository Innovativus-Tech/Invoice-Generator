'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  dot?: boolean;
  dotColor?: string;
}

export function Badge({ children, className, variant = 'default', dot, dotColor }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    success: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor || 'bg-current')} />}
      {children}
    </span>
  );
}
