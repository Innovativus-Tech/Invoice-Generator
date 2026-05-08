'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { InventoryItem, InventoryFormValues, ApiResponse } from '@/types';
import { useState, useEffect } from 'react';

export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  search: (q: string) => ['inventory-search', q] as const,
};

export function useInventory() {
  return useQuery({
    queryKey: inventoryKeys.lists(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<InventoryItem[]>>('/inventory');
      return data.data || [];
    },
  });
}

export function useInventorySearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: inventoryKeys.search(debouncedQuery),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{items: InventoryItem[]}>>(`/inventory/search?q=${encodeURIComponent(debouncedQuery)}`);
      return data.data?.items || [];
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InventoryFormValues) => {
      const { data } = await apiClient.post('/inventory', values);
      return data.data as InventoryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success('Item added to inventory');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add item');
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<InventoryFormValues> }) => {
      const { data } = await apiClient.put(`/inventory/${id}`, values);
      return data.data as InventoryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success('Item updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update item');
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success('Item deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete item');
    },
  });
}

export function useUploadInventoryCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post('/inventory/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`Imported ${data?.data?.inserted || 0} items`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to import CSV');
    },
  });
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
