'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { Client, ClientWithInvoices, ClientFormValues, ApiResponse } from '@/types';

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

export function useClients() {
  return useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Client[]>>('/clients');
      return data.data || [];
    },
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
    mutationFn: async (values: ClientFormValues) => {
      const { data } = await apiClient.post('/clients', values);
      return data.data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success('Client created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create client');
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      if (data?.id) {
        queryClient.setQueryData(clientKeys.detail(data.id), data);
      }
      toast.success('Client updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update client');
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
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success('Client deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete client');
    },
  });
}
