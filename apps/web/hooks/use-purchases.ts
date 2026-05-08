'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { PurchaseSummary, PurchaseOrder, PurchaseFormValues } from '@/types';

export const purchaseKeys = {
  all: ['purchases'] as const,
  list: (month: number, year: number, page: number) => [...purchaseKeys.all, 'list', month, year, page] as const,
  summary: (month: number, year: number) => [...purchaseKeys.all, 'summary', month, year] as const,
  nextOrderId: () => [...purchaseKeys.all, 'next-order-id'] as const,
};

export function usePurchaseSummary(month: number, year: number) {
  return useQuery({
    queryKey: purchaseKeys.summary(month, year),
    queryFn: async () => {
      const { data } = await apiClient.get(`/purchases/summary?month=${month}&year=${year}`);
      return data.data as PurchaseSummary;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePurchases(month: number, year: number, page: number) {
  return useQuery({
    queryKey: purchaseKeys.list(month, year, page),
    queryFn: async () => {
      const { data } = await apiClient.get(`/purchases?month=${month}&year=${year}&page=${page}&limit=10`);
      return data as { data: { orders: PurchaseOrder[]; total: number; page: number; limit: number; totalPages: number } };
    },
  });
}

export function useNextOrderId() {
  return useQuery({
    queryKey: purchaseKeys.nextOrderId(),
    queryFn: async () => {
      const { data } = await apiClient.get('/purchases/next-order-id');
      return data.data.order_id as string;
    },
    staleTime: 0,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: PurchaseFormValues) => {
      const { data } = await apiClient.post('/purchases', values);
      return data.data as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      toast.success('Purchase order created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create purchase');
    },
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: PurchaseFormValues & { id: string }) => {
      const { data } = await apiClient.put(`/purchases/${id}`, values);
      return data.data as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      toast.success('Purchase order updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update purchase');
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      toast.success('Purchase order deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete purchase');
    },
  });
}
