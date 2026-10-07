'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

/** Pill-style single choice (Cash / Credit, % / ₹, Courier / Transport…). */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', className, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex gap-1 rounded-lg bg-surface p-1 dark:bg-[#0F0E17]', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-all',
              size === 'sm' && 'px-2.5 py-1 text-xs',
              size === 'md' && 'px-3.5 py-1.5 text-sm',
              size === 'lg' && 'px-5 py-2.5 text-sm',
              active ? 'bg-white text-primary shadow-sm dark:bg-card' : 'text-text-2 hover:text-text-1'
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
