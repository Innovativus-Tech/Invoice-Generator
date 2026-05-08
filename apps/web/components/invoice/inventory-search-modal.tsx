import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { X, Search, Check, Plus } from 'lucide-react';
import type { InventoryItem } from '@/types';

interface InventorySearchModalProps {
  open: boolean;
  onClose: () => void;
  onAddItem: (item: InventoryItem) => void;
}

export function InventorySearchModal({ open, onClose, onAddItem }: InventorySearchModalProps) {
  const [query, setQuery] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setInputVal('');
      setQuery('');
      setAddedIds({});
    }
  }, [open]);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputVal), 300);
    return () => clearTimeout(timer);
  }, [inputVal]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['inv-modal-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await apiClient.get(
        `/inventory/search?q=${encodeURIComponent(query)}`
      );
      return res.data.data.items as InventoryItem[];
    },
    enabled: query.length >= 2 && open,
    staleTime: 60000,
  });

  if (!open) return null;

  const handleAdd = (item: InventoryItem) => {
    onAddItem(item);
    setAddedIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [item.id]: false }));
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-card w-full max-w-[600px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-1">Add from Inventory</h2>
          <button 
            type="button"
            onClick={onClose}
            className="text-text-2 hover:text-text-1 p-1 rounded-full hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Search Input Block */}
        <div className="p-4 border-b border-border bg-surface dark:bg-[#0F0E17]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search by book title, ISBN, or author..."
              className="w-full bg-white dark:bg-black border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-card min-h-[300px]">
          {query.length < 2 && (
            <div className="flex items-center justify-center h-full text-sm text-text-2 py-12">
              Search for books above to add them to the invoice
            </div>
          )}
          
          {query.length >= 2 && !isFetching && results.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-text-2 py-12">
              No books found for &quot;{query}&quot;
            </div>
          )}

          {results.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between px-6 py-3 border-b border-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-primary/5 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="text-sm font-medium text-text-1 truncate">
                  {item.book_title}
                  {item.isbn && (
                    <span className="text-text-2 font-normal ml-1"> (ISBN: {item.isbn})</span>
                  )}
                </div>
                <div className="text-xs text-text-2 mt-1 truncate">
                  {[item.author, item.publisher].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-sm font-medium text-text-1 text-right">
                  {item.price > 0 ? `₹${item.price}` : 'Price TBD'}
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(item)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all min-w-[72px]
                    ${addedIds[item.id] 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30'
                    }`}
                >
                  {addedIds[item.id] ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Add
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface dark:bg-[#0F0E17] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
