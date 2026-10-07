'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { balanceLabel, cn } from '@/lib/utils';
import { PARTY_TYPE_LABEL } from '@/lib/doc-types';
import type { Client } from '@/types';

interface PartyComboboxProps {
  parties: Client[];
  value: string | null;
  onChange: (party: Client | null) => void;
  label?: string;
  placeholder?: string;
  onAddNew?: (name: string) => void;
  error?: string;
  disabled?: boolean;
}

export function PartyCombobox({ parties, value, onChange, label, placeholder = 'Search party by name, phone or GSTIN…', onAddNew, error, disabled }: PartyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = parties.find((p) => p.id === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? parties.filter((p) =>
          [p.name, p.company, p.phone, p.gstin].some((v) => v?.toLowerCase().includes(q)))
      : parties;
    return list.slice(0, 50);
  }, [parties, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => setActive(0), [query]);

  const pick = (p: Client | null) => {
    onChange(p);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (results[active]) pick(results[active]);
      else if (onAddNew && query.trim()) { onAddNew(query.trim()); setOpen(false); }
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full">
      {label && <label className="block text-sm font-medium text-text-1 mb-1.5">{label}</label>}
      {selected && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={cn(
            'w-full min-h-10 flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-1.5 text-left dark:bg-card',
            error ? 'border-danger' : 'border-border hover:border-primary/50'
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text-1 truncate">{selected.name}</span>
            <span className="block text-xs text-text-2 truncate">
              {[selected.company, selected.phone, selected.party_type && PARTY_TYPE_LABEL[selected.party_type]].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {selected.balance !== undefined && (
              <span className={cn('text-xs font-medium', (selected.balance ?? 0) > 0 ? 'text-amber-600' : (selected.balance ?? 0) < 0 ? 'text-blue-600' : 'text-text-2')}>
                {balanceLabel(selected.balance)}
              </span>
            )}
            {!disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear party"
                onClick={(e) => { e.stopPropagation(); pick(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); pick(null); } }}
                className="p-1 rounded text-text-2 hover:text-danger hover:bg-surface"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
          <input
            ref={inputRef}
            value={query}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full h-10 rounded-md border bg-white pl-9 pr-8 text-sm text-text-1 placeholder:text-text-2/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card',
              error ? 'border-danger' : 'border-border'
            )}
          />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2 pointer-events-none" />
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-white shadow-lg dark:bg-card">
          {results.length === 0 && (
            <p className="px-3 py-3 text-sm text-text-2">No party matches &quot;{query}&quot;</p>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2 text-left border-b border-border/50 last:border-0',
                i === active ? 'bg-primary/5' : 'hover:bg-surface dark:hover:bg-border/30'
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-1 truncate">{p.name}</span>
                <span className="block text-xs text-text-2 truncate">
                  {[p.company, p.phone, p.credit_days ? `${p.credit_days} days credit` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              {p.balance !== undefined && Math.abs(p.balance) >= 0.005 && (
                <span className={cn('text-xs font-medium flex-shrink-0', p.balance > 0 ? 'text-amber-600' : 'text-blue-600')}>
                  {balanceLabel(p.balance)}
                </span>
              )}
            </button>
          ))}
          {onAddNew && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onAddNew(query.trim()); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 border-t border-border sticky bottom-0 bg-white dark:bg-card"
            >
              <Plus className="h-4 w-4" />
              {query.trim() ? `Add "${query.trim()}" as a new party` : 'Add a new party'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
