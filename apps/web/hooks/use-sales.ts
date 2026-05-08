'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { SalesSummary } from '@/types';

export const salesKeys = {
  all: ['sales'] as const,
  summary: (month: number, year: number) => [...salesKeys.all, 'summary', month, year] as const,
};

export function useSalesSummary(month: number, year: number) {
  return useQuery({
    queryKey: salesKeys.summary(month, year),
    queryFn: async () => {
      const { data } = await apiClient.get(`/sales/summary?month=${month}&year=${year}`);
      return data.data as SalesSummary;
    },
    staleTime: 5 * 60 * 1000,
  });
}
