'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InventoryItem, InventoryFormValues } from '@/types';

interface InventoryFormProps {
  open: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  onSave: (values: InventoryFormValues) => void;
  loading: boolean;
}

const defaultForm: InventoryFormValues = {
  book_title: '',
  isbn: '',
  author: '',
  publisher: '',
  product_form: '',
  language: '',
  applicant_type: '',
  imprint: '',
  publication_date: '',
  price: 0,
  gst_rate: 0,
  stock: 1,
};

export function InventoryForm({ open, onClose, item, onSave, loading }: InventoryFormProps) {
  const [form, setForm] = useState<InventoryFormValues>(defaultForm);

  useEffect(() => {
    if (item) {
      setForm({
        book_title: item.book_title || '',
        isbn: item.isbn || '',
        author: item.author || '',
        publisher: item.publisher || '',
        product_form: item.product_form || '',
        language: item.language || '',
        applicant_type: item.applicant_type || '',
        imprint: item.imprint || '',
        publication_date: item.publication_date || '',
        price: item.price || 0,
        gst_rate: item.gst_rate ?? 0,
        stock: item.stock ?? 1,
      });
    } else {
      setForm(defaultForm);
    }
  }, [item, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-card border-l border-border z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-1">
                  {item ? 'Edit Book' : 'New Book'}
                </h2>
                <button onClick={onClose} className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-surface transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Book Title"
                  value={form.book_title}
                  onChange={(e) => setForm({ ...form, book_title: e.target.value })}
                  required
                />

                <Input
                  label="ISBN"
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                />
                
                <Input
                  label="Author"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                />

                <Input
                  label="Publisher"
                  value={form.publisher}
                  onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Product Form"
                    value={form.product_form}
                    onChange={(e) => setForm({ ...form, product_form: e.target.value })}
                    placeholder="e.g. Book, E-book"
                  />
                  <Input
                    label="Language"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Price (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price || ''}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    label="Stock"
                    type="number"
                    min="0"
                    value={form.stock || ''}
                    onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="GST Rate (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.gst_rate || ''}
                    onChange={(e) => setForm({ ...form, gst_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                  <Button className="flex-1" onClick={() => onSave(form)} loading={loading} disabled={!form.book_title}>
                    {item ? 'Update' : 'Create'} Book
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
