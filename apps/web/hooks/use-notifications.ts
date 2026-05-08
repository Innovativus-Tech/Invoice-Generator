'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  preferences: ['notification-preferences'] as const,
};

export interface Notification {
  id: string;
  type: 'invoice_viewed' | 'payment_received' | 'invoice_overdue';
  title: string;
  message: string;
  invoice_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  invoice_viewed: boolean;
  payment_received: boolean;
  invoice_overdue: boolean;
  updated_at: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data.data as Notification[];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count');
      return data.data.count as number;
    },
    refetchInterval: 60000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/preferences');
      return data.data as NotificationPreferences;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<NotificationPreferences>) => {
      const { data } = await apiClient.put('/notifications/preferences', values);
      return data.data as NotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences });
      toast.success('Preferences saved');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });
}
