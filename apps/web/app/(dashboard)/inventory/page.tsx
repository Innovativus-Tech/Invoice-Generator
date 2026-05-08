'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { InventoryForm } from '@/components/inventory/inventory-form';
import { CsvUpload } from '@/components/inventory/csv-upload';
import { useInventory, useInventorySearch, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';
import type { InventoryItem, InventoryFormValues } from '@/types';
import { Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 50;

export default function InventoryPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: allItems, isLoading } = useInventory();
  const { data: searchResults, isFetching } = useInventorySearch(searchQuery);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const { can } = usePermissions();

  const isSearchMode = searchQuery.trim().length >= 2;

  const totalItems = isSearchMode ? (searchResults || []).length : (allItems || []).length;
  const totalPages = isSearchMode ? 1 : Math.ceil(totalItems / ITEMS_PER_PAGE);

  const displayedItems = useMemo(() => {
    if (isSearchMode) {
      return searchResults || [];
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return (allItems || []).slice(start, start + ITEMS_PER_PAGE);
  }, [isSearchMode, searchResults, allItems, currentPage]);

  const handleSave = (values: InventoryFormValues) => {
    if (editingItem) {
      updateItem.mutate(
        { id: editingItem.id, values },
        { onSuccess: () => { setDrawerOpen(false); setEditingItem(null); } }
      );
    } else {
      createItem.mutate(values, {
        onSuccess: () => { setDrawerOpen(false); },
      });
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItem.mutate(id);
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-full pb-8">
      <PageHeader 
        title="Inventory" 
        description={`${(allItems || []).length} items in stock`}
      >
        <div className="flex items-center gap-3">
          {can('inventory', 'create') && (
            <>
              <CsvUpload />
              <Button onClick={handleAdd} icon={<Plus className="h-4 w-4" />}>
                Add Item
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-card p-4 rounded-xl border border-border">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-2" />
            <input
              type="text"
              placeholder="Search by book title, ISBN, or author..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-10 py-2 bg-surface dark:bg-[#0F0E17] border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
            )}
          </div>
        </div>
        {isSearchMode && (
          <div className="text-sm text-text-2 px-1">
            Showing {totalItems} results for &apos;{searchQuery}&apos;
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-border/40 rounded w-full" />
          <div className="h-16 bg-border/20 rounded w-full" />
          <div className="h-16 bg-border/20 rounded w-full" />
        </div>
      ) : (
        <>
          <InventoryTable 
            items={displayedItems} 
            onEdit={handleEdit} 
            onDelete={handleDelete}
            currentPage={currentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            canEdit={can('inventory', 'update')}
            canDelete={can('inventory', 'delete')}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-text-2">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} entries
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>
                <span className="text-sm text-text-1 px-4 font-medium">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <InventoryForm
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingItem(null); }}
        item={editingItem}
        onSave={handleSave}
        loading={createItem.isPending || updateItem.isPending}
      />
    </div>
  );
}
