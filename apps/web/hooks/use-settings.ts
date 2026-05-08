'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { Profile, SettingsFormValues, DashboardStats, RevenueDataPoint, ApiResponse } from '@/types';

export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  revenue: (period: string) => [...dashboardKeys.all, 'revenue', period] as const,
};

// Settings / Profile
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Profile>>('/settings');
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<SettingsFormValues>) => {
      const { data } = await apiClient.put('/settings', values);
      return data.data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success('Settings saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to save settings');
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await apiClient.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success('Logo uploaded');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to upload logo');
    },
  });
}

export function useUploadSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File | Blob) => {
      const formData = new FormData();
      formData.append('signature', file);
      const { data } = await apiClient.post('/settings/signature', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success('Signature uploaded');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to upload signature');
    },
  });
}

// Dashboard
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/dashboard/stats');
      return data.data;
    },
  });
}

export function useRevenueChart(period: string = '6m') {
  return useQuery({
    queryKey: dashboardKeys.revenue(period),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RevenueDataPoint[]>>(`/dashboard/revenue?period=${period}`);
      return data.data || [];
    },
  });
}
