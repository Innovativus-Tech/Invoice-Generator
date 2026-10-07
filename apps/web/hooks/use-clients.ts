'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { apiError } from '@/lib/utils';
import { invalidateBusinessData } from './use-documents';
import type { Client, ClientWithInvoices, ClientFormValues, ApiResponse, PartyLedger } from '@/types';

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

/** Parties with live balances. `type` narrows to customers or suppliers/binders. */
export function useClients(type?: 'customer' | 'supplier') {
  return useQuery({
    queryKey: [...clientKeys.lists(), type ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Client[]>>(`/clients${type ? `?type=${type}` : ''}`);
      return data.data || [];
    },
  });
}

/** Account statement with running balance. */
export function useClientLedger(id: string, from?: string, to?: string) {
  return useQuery({
    queryKey: [...clientKeys.detail(id), 'ledger', from ?? '', to ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await apiClient.get<ApiResponse<PartyLedger>>(`/clients/${id}/ledger?${params}`);
      return data.data!;
    },
    enabled: !!id,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ClientWithInvoices>>(`/clients/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<ClientFormValues>) => {
      const { data } = await apiClient.post('/clients', values);
      return data.data as Client;
    },
    onSuccess: () => {
      invalidateBusinessData(queryClient);
      toast.success('Party created');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Failed to create party'));
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ClientFormValues> }) => {
      const { data } = await apiClient.put(`/clients/${id}`, values);
      return data.data as Client;
    },
    onSuccess: () => {
      invalidateBusinessData(queryClient);
      toast.success('Party updated');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Failed to update party'));
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      invalidateBusinessData(queryClient);
      toast.success('Party deleted');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Failed to delete party'));
    },
  });
}
