'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { StatusBadge } from '@/components/invoice/status-badge';
import type { InvoiceStatus } from '@/types';

interface SearchInvoice {
  id: string;
  invoice_number: string;
  bill_number: string;
  client_name: string;
  total: number;
  status: InvoiceStatus;
  issue_date: string;
}

interface SearchClient {
  id: string;
  name: string;
  company: string;
  email: string;
}

interface SearchResponse {
  data: {
    invoices: SearchInvoice[];
    clients: SearchClient[];
  };
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debouncedQuery = useDebounce(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get<SearchResponse>(`/search?q=${encodeURIComponent(debouncedQuery)}`);
      return data.data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Open dropdown when we have a valid query
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [debouncedQuery]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigateTo = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  }, [router]);

  const invoices = data?.invoices || [];
  const clients = data?.clients || [];
  const hasResults = invoices.length > 0 || clients.length > 0;
  const showDropdown = open && debouncedQuery.length >= 2;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (debouncedQuery.length >= 2) setOpen(true); }}
        placeholder="Search invoices, clients..."
        className="h-9 w-64 rounded-lg border border-border bg-surface pl-9 pr-9 text-sm text-text-1 placeholder:text-text-2/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors dark:bg-card dark:border-border"
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2 animate-spin" />
      )}

      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 min-w-[420px] bg-white dark:bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden">
          {!hasResults && !isFetching && (
            <div className="py-6 text-center text-sm text-gray-400 dark:text-text-2">
              No results for &apos;{debouncedQuery}&apos;
            </div>
          )}

          {invoices.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-text-2 uppercase tracking-wider">
                Invoices
              </div>
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => navigateTo(`/invoices/${inv.id}`)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-border/30 cursor-pointer transition-colors text-left"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-medium text-sm text-text-1">{inv.invoice_number}</span>
                    <span className="text-xs text-text-2">
                      {inv.client_name} · {formatDate(inv.issue_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-1">{formatCurrency(Number(inv.total))}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {clients.length > 0 && (
            <div>
              {invoices.length > 0 && <div className="border-t border-border" />}
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-text-2 uppercase tracking-wider">
                Clients
              </div>
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => navigateTo(`/clients/${client.id}`)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-border/30 cursor-pointer transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-white">{getInitials(client.name)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-1">{client.name}</span>
                    {client.company && (
                      <span className="text-xs text-text-2">{client.company}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
