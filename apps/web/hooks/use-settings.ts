'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type { Profile, SettingsFormValues, ApiResponse, NumberSeries } from '@/types';
import { apiError } from '@/lib/utils';

export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
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

// Document numbering (separate series per document type)
export function useNumbering() {
  return useQuery({
    queryKey: [...settingsKeys.all, 'numbering'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<NumberSeries[]>>('/settings/numbering');
      return data.data || [];
    },
  });
}

export function useUpdateNumbering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (series: Pick<NumberSeries, 'doc_type' | 'prefix' | 'next_number' | 'include_year'>[]) => {
      const { data } = await apiClient.put<ApiResponse<NumberSeries[]>>('/settings/numbering', { series });
      return data.data || [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Numbering saved');
    },
    onError: (err) => toast.error(apiError(err, 'Could not save numbering')),
  });
}
