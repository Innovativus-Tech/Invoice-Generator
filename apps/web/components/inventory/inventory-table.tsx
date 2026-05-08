'use client';

import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface InventoryTableProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  currency?: string;
  currentPage: number;
  itemsPerPage: number;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function InventoryTable({ items, onEdit, onDelete, currency = 'INR', currentPage, itemsPerPage, canEdit = true, canDelete = true }: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-text-2 bg-white dark:bg-card rounded-xl border border-border">
        No inventory items found. Add items or upload a CSV to get started.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface dark:bg-[#0F0E17] border-b border-border text-xs font-semibold text-text-2 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">#</th>
              <th className="px-6 py-4">Book Title</th>
              <th className="px-6 py-4">ISBN</th>
              <th className="px-6 py-4">Author</th>
              <th className="px-6 py-4">Publisher</th>
              <th className="px-6 py-4">Product Form</th>
              <th className="px-6 py-4">Language</th>
              <th className="px-6 py-4 text-right">Price ({currency === 'INR' ? '₹' : currency})</th>
              <th className="px-6 py-4 text-center">GST %</th>
              <th className="px-6 py-4 text-center">Stock</th>
              {(canEdit || canDelete) && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-border/30 transition-colors group">
                <td className="px-6 py-4 text-text-2 text-xs">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                <td className="px-6 py-4 font-medium text-text-1">
                  {item.book_title}
                </td>
                <td className="px-6 py-4 text-text-2 font-mono text-xs">
                  {item.isbn || '-'}
                </td>
                <td className="px-6 py-4 text-text-1">
                  {item.author || '-'}
                </td>
                <td className="px-6 py-4 text-text-1">
                  {item.publisher || '-'}
                </td>
                <td className="px-6 py-4 text-text-2">
                  {item.product_form || '-'}
                </td>
                <td className="px-6 py-4 text-text-2">
                  {item.language || '-'}
                </td>
                <td className="px-6 py-4 text-right font-medium text-text-1">
                  {formatCurrency(item.price, currency)}
                </td>
                <td className="px-6 py-4 text-center text-text-2">
                  {item.gst_rate}%
                </td>
                <td className="px-6 py-4 text-center text-text-1">
                  {item.stock}
                </td>
                {(canEdit || canDelete) && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 rounded text-text-2 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 rounded text-text-2 hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
