'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { apiError, inr } from '@/lib/utils';
import { invalidateBusinessData } from './use-documents';
import type { ApiResponse, Payment, PaymentFormValues, PaymentMethod } from '@/types';

export interface PaymentFilters {
  direction?: 'in' | 'out';
  client_id?: string;
  invoice_id?: string;
  mode?: PaymentMethod;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface PaymentList {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { received: number; paid: number };
}

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const { data } = await apiClient.get<ApiResponse<PaymentList>>(`/payments?${params}`);
      return data.data!;
    },
    placeholderData: keepPreviousData,
  });
}

function toPayload(values: PaymentFormValues) {
  return {
    ...values,
    client_id: values.client_id || null,
    invoice_id: values.invoice_id || null,
    amount: Number(values.amount),
  };
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      const { data } = await apiClient.post<ApiResponse<Payment>>('/payments', toPayload(values));
      return data.data!;
    },
    onSuccess: (p) => {
      invalidateBusinessData(qc);
      toast.success(`${p.direction === 'in' ? 'Received' : 'Paid'} ${inr(p.amount)}${p.party_name ? ` · ${p.party_name}` : ''}`);
    },
    onError: (err) => toast.error(apiError(err, 'Could not record the payment')),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PaymentFormValues }) => {
      const { data } = await apiClient.put<ApiResponse<Payment>>(`/payments/${id}`, toPayload(values));
      return data.data!;
    },
    onSuccess: () => {
      invalidateBusinessData(qc);
      toast.success('Payment updated');
    },
    onError: (err) => toast.error(apiError(err, 'Could not update the payment')),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/payments/${id}`);
    },
    onSuccess: () => {
      invalidateBusinessData(qc);
      toast.success('Payment deleted');
    },
    onError: (err) => toast.error(apiError(err, 'Could not delete the payment')),
  });
}
