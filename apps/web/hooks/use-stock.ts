'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { apiError } from '@/lib/utils';
import { invalidateBusinessData } from './use-documents';
import type { ApiResponse, StockFilter, StockMovement, StockRow, StockSummary } from '@/types';

export function useStockSummary(q: { search?: string; binding?: string; filter: StockFilter; page: number; limit?: number }) {
  return useQuery({
    queryKey: ['stock', 'summary', q],
    queryFn: async () => {
      const params = new URLSearchParams({ filter: q.filter, page: String(q.page), limit: String(q.limit ?? 50) });
      if (q.search) params.set('search', q.search);
      if (q.binding) params.set('binding', q.binding);
      const { data } = await apiClient.get<ApiResponse<StockSummary>>(`/stock?${params}`);
      return data.data!;
    },
    placeholderData: keepPreviousData,
  });
}

export function useStockMovements(q: { item_id?: string; from?: string; to?: string; page: number }, enabled = true) {
  return useQuery({
    queryKey: ['stock', 'movements', q],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(q.page), limit: '50' });
      if (q.item_id) params.set('item_id', q.item_id);
      if (q.from) params.set('from', q.from);
      if (q.to) params.set('to', q.to);
      const { data } = await apiClient.get<ApiResponse<{ movements: StockMovement[]; total: number; totalPages: number; page: number }>>(`/stock/movements?${params}`);
      return data.data!;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, ...body }: { itemId: string; qty_change: number; damaged_change: number; reason: string; date?: string }) => {
      const { data } = await apiClient.post<ApiResponse<StockRow>>(`/stock/${itemId}/adjust`, body);
      return data.data!;
    },
    onSuccess: (row) => {
      invalidateBusinessData(qc);
      toast.success(`${row.book_title}: stock now ${row.stock}${row.damaged_stock ? `, damaged ${row.damaged_stock}` : ''}`);
    },
    onError: (err) => toast.error(apiError(err, 'Could not adjust stock')),
  });
}
