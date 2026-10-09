'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { apiError } from '@/lib/utils';
import type { ApiResponse, BindingRate } from '@/types';

const key = ['settings', 'binding-rates'] as const;

/** Rate card: binding charge per copy by binding type. */
export function useBindingRates() {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<BindingRate[]>>('/settings/binding-rates');
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Charge per copy for a binding name (case-insensitive), or undefined if not on the card. */
export function rateFor(rates: BindingRate[] | undefined, binding: string | null | undefined): number | undefined {
  if (!binding) return undefined;
  return rates?.find((r) => r.name.toLowerCase() === binding.trim().toLowerCase())?.charge;
}

export function useSaveBindingRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rates: BindingRate[]) => {
      const { data } = await apiClient.put<ApiResponse<BindingRate[]>>('/settings/binding-rates', { rates });
      return data.data || [];
    },
    onSuccess: (rates) => {
      qc.setQueryData(key, rates);
      toast.success('Binding rates saved');
    },
    onError: (err) => toast.error(apiError(err, 'Could not save binding rates')),
  });
}
