'use client';

import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { ApiResponse, DashboardOverview, OutstandingReport, PeriodReport, ReportPeriod } from '@/types';

export function usePeriodReport(period: ReportPeriod, year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'summary', period, year, month],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PeriodReport>>(`/reports/summary?period=${period}&year=${year}&month=${month}`);
      return data.data!;
    },
    placeholderData: keepPreviousData,
  });
}

export function useOutstanding(side: 'receivable' | 'payable', clientId?: string) {
  return useQuery({
    queryKey: ['outstanding', side, clientId ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({ side });
      if (clientId) params.set('client_id', clientId);
      const { data } = await apiClient.get<ApiResponse<OutstandingReport>>(`/reports/outstanding?${params}`);
      return data.data!;
    },
  });
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
      return data.data!;
    },
    refetchInterval: 60_000,
  });
}

export function useExportReportPdf() {
  return useMutation({
    mutationFn: async ({ period, year, month, label }: { period: ReportPeriod; year: number; month: number; label: string }) => {
      const response = await apiClient.get(`/reports/export-pdf?period=${period}&year=${year}&month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales-Purchase-Report-${label.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Report downloaded'),
    onError: () => toast.error('Could not export the report'),
  });
}
