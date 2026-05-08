'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFormContext, useFieldArray, type Path } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Trash2, GripVertical, Plus, Search } from 'lucide-react';
import { InventorySearchModal } from './inventory-search-modal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { formatIndianCurrency } from '@/lib/utils';
import type { InvoiceFormValues, InventoryItem } from '@/types';

function InventorySearchInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelect: (item: InventoryItem) => void;
}) {
  const [inputVal, setInputVal] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputVal), 300);
    return () => clearTimeout(timer);
  }, [inputVal]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['inv-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await apiClient.get(
        `/inventory/search?q=${encodeURIComponent(query)}`
      );
      return res.data.data.items as InventoryItem[];
    },
    enabled: query.length >= 2,
    staleTime: 60000,
  });

  const showDropdown = open && query.length >= 2 &&
                       (results.length > 0 || isFetching);

  function handleSelect(item: InventoryItem) {
    const label = item.isbn
      ? `${item.book_title} (ISBN: ${item.isbn})`
      : item.book_title;
    setInputVal(label);
    onChange(label);
    onSelect(item);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Update position whenever dropdown opens or window scrolls
  useEffect(() => {
    if (!showDropdown || !inputRef.current) return;

    function updatePos() {
      const rect = inputRef.current!.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 380),
      });
    }

    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [showDropdown]);

  // Render dropdown via portal:
  const dropdown = showDropdown ? createPortal(
    <div style={{
      position: 'absolute',
      top: dropdownPos.top,
      left: dropdownPos.left,
      width: dropdownPos.width,
      zIndex: 99999,
      maxHeight: '280px',
      overflowY: 'auto',
      background: 'white',
      border: '1px solid #E4E2F0',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      {isFetching && results.length === 0 && (
        <div style={{ padding: '12px 16px', fontSize: '13px', color: '#9B98AE' }}>
          Searching...
        </div>
      )}
      {!isFetching && results.length === 0 && (
        <div style={{ padding: '12px 16px', fontSize: '13px', color: '#9B98AE' }}>
          No books found for &quot;{query}&quot;
        </div>
      )}
      {results.map((item, idx) => (
        <div
          key={item.id}
          onMouseDown={() => handleSelect(item)}
          style={{
            padding: '10px 14px',
            cursor: 'pointer',
            background: idx === activeIndex ? '#F3F2FF' : 'white',
            borderBottom: '1px solid #F1EFF8',
          }}
          onMouseEnter={() => setActiveIndex(idx)}
        >
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1825' }}>
            {item.book_title}
            {item.isbn && (
              <span style={{ color: '#9B98AE', fontWeight: 400 }}>
                {' '}(ISBN: {item.isbn})
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#9B98AE', marginTop: '2px' }}>
            {[item.author, item.publisher].filter(Boolean).join(' · ')}
            {item.product_form && (
              <span style={{ marginLeft: '8px', color: '#CBD5E1' }}>
                {item.product_form}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        placeholder="Type to search inventory or enter manually..."
        onChange={e => {
          setInputVal(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => inputVal.length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        style={{ width: '100%' }}
        className="w-full bg-transparent text-sm outline-none p-1"
      />

      {dropdown}
    </div>
  );
}

function SortableRow({
  id,
  index,
  onRemove,
}: {
  id: string;
  index: number;
  onRemove: () => void;
}) {
  const { register, watch, setValue, trigger } = useFormContext<InvoiceFormValues>();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const description = watch(`items.${index}.description`) || '';

  function handleInventorySelect(rowIndex: number, item: InventoryItem) {
    const label = item.isbn
      ? `${item.book_title} (ISBN: ${item.isbn})`
      : item.book_title;

    setValue(`items.${rowIndex}.description` as Path<InvoiceFormValues>, label);
    setValue(`items.${rowIndex}.gst_rate` as Path<InvoiceFormValues>, item.gst_rate);
    if (item.price > 0) {
      setValue(`items.${rowIndex}.unit_price` as Path<InvoiceFormValues>, item.price);
    }
    // Trigger recalculation of amount by triggering the fields if needed, 
    // or useEffect on amount handles it automatically in this codebase.
    trigger(`items.${rowIndex}` as Path<InvoiceFormValues>);

    // Move focus to Qty field
    setTimeout(() => {
      document.getElementById(`qty-${rowIndex}`)?.focus();
    }, 50);
  }


  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const qty = watch(`items.${index}.quantity`) || 0;
  const price = watch(`items.${index}.unit_price`) || 0;
  const disc = watch(`items.${index}.discount_percent`) || 0;
  const amount = qty * price * (1 - disc / 100);

  React.useEffect(() => {
    setValue(`items.${index}.amount`, amount);
  }, [amount, index, setValue]);

  const inputCls =
    'w-full bg-transparent text-xs text-text-1 focus:outline-none border-0 p-1 rounded hover:bg-surface focus:bg-surface dark:hover:bg-border/30 dark:focus:bg-border/30 transition-colors';

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border group bg-white dark:bg-card">
      {/* Drag handle */}
      <td className="px-1 py-1 w-6">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 rounded text-text-2 hover:text-text-1 opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      </td>

      {/* SI No. (auto) */}
      <td className="px-1 py-1 w-8 text-center text-xs text-text-2 font-medium">
        {index + 1}
      </td>

      {/* Description */}
      <td className="px-1 py-1" style={{ verticalAlign: 'top' }}>
        <InventorySearchInput
          value={description}
          onChange={(val) => setValue(`items.${index}.description`, val)}
          onSelect={(item) => handleInventorySelect(index, item)}
        />
      </td>

      {/* HSN/SAC */}
      <td className="px-1 py-1 w-24">
        <input
          {...register(`items.${index}.hsn_sac`)}
          placeholder="HSN/SAC"
          className={`${inputCls} text-center`}
        />
      </td>

      {/* GST Rate */}
      <td className="px-1 py-1 w-20">
        <input
          {...register(`items.${index}.gst_rate`, { valueAsNumber: true })}
          type="number"
          min="0"
          max="100"
          step="0.5"
          placeholder="18"
          className={`${inputCls} text-center`}
        />
      </td>

      {/* Qty */}
      <td className="px-1 py-1 w-16">
        <input
          id={`qty-${index}`}
          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          type="number"
          min="0"
          step="1"
          className={`${inputCls} text-center`}
        />
      </td>

      {/* Rate per Pcs */}
      <td className="px-1 py-1 w-24">
        <input
          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
          type="number"
          min="0"
          step="0.01"
          className={`${inputCls} text-right`}
        />
      </td>

      {/* Disc. % */}
      <td className="px-1 py-1 w-16">
        <input
          {...register(`items.${index}.discount_percent`, { valueAsNumber: true })}
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="0"
          className={`${inputCls} text-center`}
        />
      </td>

      {/* Amount (read-only) */}
      <td className="px-1 py-1 w-28 text-right">
        <span className="text-xs font-medium text-text-1">
          {formatIndianCurrency(amount)}
        </span>
      </td>

      {/* Delete */}
      <td className="px-1 py-1 w-8">
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded text-text-2 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

interface LineItemsTableProps {
  currency?: string;
}

export function LineItemsTable({}: LineItemsTableProps) {
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const { control } = useFormContext<InvoiceFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'items',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  const addItem = () => {
    append({
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0,
      sort_order: fields.length,
      hsn_sac: '',
      gst_rate: 18,
      discount_percent: 0,
    });
  };

  const thCls = 'px-1 py-2 text-left text-[10px] font-semibold text-text-2 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-surface dark:bg-[#0F0E17] border-b border-border">
              <th className="px-1 py-2 w-6" />
              <th className={`${thCls} w-8 text-center`}>SI No.</th>
              <th className={thCls}>Description of Goods</th>
              <th className={`${thCls} w-24 text-center`}>HSN/SAC</th>
              <th className={`${thCls} w-20 text-center`}>GST Rate (%)</th>
              <th className={`${thCls} w-16 text-center`}>Qty</th>
              <th className={`${thCls} w-24 text-right`}>Rate per Pcs</th>
              <th className={`${thCls} w-16 text-center`}>Disc. %</th>
              <th className={`${thCls} w-28 text-right`}>Amount</th>
              <th className="px-1 py-2 w-8" />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {fields.map((field, index) => (
                  <SortableRow
                    key={field.id}
                    id={field.id}
                    index={index}
                    onRemove={() => remove(index)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addItem}
          icon={<Plus className="h-4 w-4" />}
        >
          Add line item
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setInventoryModalOpen(true)}
          className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:hover:bg-primary/10 dark:border-primary/30 dark:text-primary"
          icon={<Search className="h-4 w-4" />}
        >
          Search Inventory
        </Button>
      </div>

      <InventorySearchModal
        open={inventoryModalOpen}
        onClose={() => setInventoryModalOpen(false)}
        onAddItem={(item) => {
          append({
            description: item.isbn
              ? `${item.book_title} (ISBN: ${item.isbn})`
              : item.book_title,
            quantity: 1,
            unit_price: item.price > 0 ? item.price : 0,
            amount: item.price > 0 ? item.price : 0,
            sort_order: fields.length,
            hsn_sac: '',
            gst_rate: item.gst_rate || 0,
            discount_percent: 0,
          });
        }}
      />
    </div>
  );
}
