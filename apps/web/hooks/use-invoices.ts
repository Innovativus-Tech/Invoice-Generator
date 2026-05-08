'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import type {
  Invoice,
  InvoiceWithItems,
  InvoiceFormValues,
  InvoiceFilters,
  PaginatedResponse,
  ApiResponse,
} from '@/types';
import { calculateInvoiceTotals } from '@/lib/utils';

// Query keys
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  nextNumber: () => [...invoiceKeys.all, 'next-number'] as const,
};

// List invoices
export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      const { data } = await apiClient.get(`/invoices?${params.toString()}`);
      return data.data;
    },
  });
}

// Single invoice
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<InvoiceWithItems>>(`/invoices/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// Next invoice number
export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: invoiceKeys.nextNumber(),
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices/next-number');
      return data.data.invoice_number as string;
    },
  });
}

// Create invoice
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const { subtotal, taxAmount, total } = calculateInvoiceTotals(
        values.items,
        values.tax_rate,
        values.discount_amount
      );
      const body = {
        ...values,
        subtotal,
        tax_amount: taxAmount,
        total,
        items: values.items.map((item, i) => ({
          ...item,
          amount: item.quantity * item.unit_price,
          sort_order: i,
        })),
      };
      const { data } = await apiClient.post('/invoices', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.nextNumber() });
      toast.success('Invoice created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create invoice');
    },
  });
}

// Update invoice
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: InvoiceFormValues }) => {
      const { subtotal, taxAmount, total } = calculateInvoiceTotals(
        values.items,
        values.tax_rate,
        values.discount_amount
      );
      const body = {
        ...values,
        subtotal,
        tax_amount: taxAmount,
        total,
        items: values.items.map((item, i) => ({
          ...item,
          amount: item.quantity * item.unit_price,
          sort_order: i,
        })),
      };
      const { data } = await apiClient.put(`/invoices/${id}`, body);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      if (data?.id) {
        queryClient.setQueryData(invoiceKeys.detail(data.id), data);
      }
      toast.success('Invoice updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update invoice');
    },
  });
}

// Delete invoice
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('Invoice deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete invoice');
    },
  });
}

// Update status (optimistic)
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch(`/invoices/${id}/status`, { status });
      return data.data;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: invoiceKeys.detail(id) });
      const previous = queryClient.getQueryData(invoiceKeys.detail(id));
      queryClient.setQueryData(invoiceKeys.detail(id), (old: any) => old ? { ...old, status } : old);
      return { previous, id };
    },
    onError: (err: any, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(invoiceKeys.detail(context.id), context.previous);
      }
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    },
    onSuccess: () => {
      toast.success('Status updated');
    },
  });
}

// Send invoice
export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/invoices/${id}/send`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('Invoice sent successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to send invoice');
    },
  });
}

// Download PDF natively
export function useDownloadPdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, invoiceNumber }: { id: string; invoiceNumber: string }) => {
      // 1. Call the API to generate + upload PDF, get back the signed URL
      const { data } = await apiClient.post(`/invoices/${id}/generate-pdf`);
      const signedUrl = data.data.pdf_url;

      // 2. Fetch the PDF bytes through the signed URL
      const response = await fetch(signedUrl);
      const blob = await response.blob();

      // 3. Trigger browser download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      return true;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success('PDF downloaded successfully');
    },
    onError: (err: any) => {
      toast.error('Failed to download PDF');
    },
  });
}
