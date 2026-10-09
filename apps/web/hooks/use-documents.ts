'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { apiError } from '@/lib/utils';
import { docUi } from '@/lib/doc-types';
import type {
  ApiResponse,
  BillingDocument,
  DeliveryStatus,
  DocType,
  DocumentFilters,
  DocumentFormValues,
  DocumentListResponse,
  InvoiceStatus,
} from '@/types';

export const documentKeys = {
  all: ['documents'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
  nextNumber: (type: DocType) => [...documentKeys.all, 'next-number', type] as const,
};

/** Anything that changes stock, balances or totals touches all of these views. */
export function invalidateBusinessData(qc: QueryClient) {
  for (const key of ['documents', 'invoices', 'clients', 'dashboard', 'stock', 'inventory', 'payments', 'reports', 'outstanding', 'sales', 'notifications']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useDocuments(filters: DocumentFilters, enabled = true) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
      });
      const { data } = await apiClient.get<ApiResponse<DocumentListResponse>>(`/documents?${params}`);
      return data.data!;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDocument(id: string | null | undefined) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<BillingDocument>>(`/documents/${id}`);
      return data.data!;
    },
    enabled: !!id,
  });
}

export function useNextDocNumber(type: DocType) {
  return useQuery({
    queryKey: documentKeys.nextNumber(type),
    queryFn: async () => {
      const { data } = await apiClient.get(`/documents/next-number?type=${type}`);
      return data.data.invoice_number as string;
    },
    staleTime: 0,
  });
}

/** Form values → API payload (the server recomputes every amount). */
export function toDocumentPayload(values: DocumentFormValues) {
  return {
    ...values,
    cartons: values.cartons === null || Number.isNaN(values.cartons as number) ? null : values.cartons,
    paid_now_amount: Number(values.paid_now_amount) || 0,
    items: values.items.map((item, i) => ({
      item_id: item.item_id || null,
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      discount_percent: Number(item.discount_percent) || 0,
      gst_rate: item.gst_rate == null || Number.isNaN(item.gst_rate) ? null : Number(item.gst_rate),
      hsn_sac: item.hsn_sac || '',
      isbn: item.isbn || null,
      author: item.author || null,
      binding: item.binding || null,
      damaged_qty: Number(item.damaged_qty) || 0,
      binding_charge: Number(item.binding_charge) || 0,
      sort_order: i,
    })),
  };
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, values }: { type: DocType; values: DocumentFormValues }) => {
      const { data } = await apiClient.post<ApiResponse<BillingDocument>>('/documents', { doc_type: type, ...toDocumentPayload(values) });
      return data.data!;
    },
    onSuccess: (doc) => {
      invalidateBusinessData(qc);
      toast.success(`${docUi(doc.doc_type).label} ${doc.invoice_number} saved`);
    },
    onError: (err) => toast.error(apiError(err, 'Could not save the document')),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: DocumentFormValues }) => {
      const { data } = await apiClient.put<ApiResponse<BillingDocument>>(`/documents/${id}`, toDocumentPayload(values));
      return data.data!;
    },
    onSuccess: (doc) => {
      invalidateBusinessData(qc);
      qc.setQueryData(documentKeys.detail(doc.id), doc);
      toast.success(`${docUi(doc.doc_type).label} updated`);
    },
    onError: (err) => toast.error(apiError(err, 'Could not update the document')),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      invalidateBusinessData(qc);
      toast.success('Deleted');
    },
    onError: (err) => toast.error(apiError(err, 'Could not delete')),
  });
}

export function useUpdateDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { data } = await apiClient.patch<ApiResponse<BillingDocument>>(`/documents/${id}/status`, { status });
      return data.data!;
    },
    onSuccess: (doc, { status }) => {
      invalidateBusinessData(qc);
      qc.setQueryData(documentKeys.detail(doc.id), doc);
      toast.success(status === 'cancelled' ? 'Cancelled — stock and balances reversed' : status === 'paid' ? 'Marked as paid' : 'Status updated');
    },
    onError: (err) => toast.error(apiError(err, 'Could not update status')),
  });
}

export function useApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<BillingDocument>>(`/documents/${id}/${decision}`, reason ? { reason } : {});
      return data.data!;
    },
    onSuccess: (doc, { decision }) => {
      invalidateBusinessData(qc);
      qc.setQueryData(documentKeys.detail(doc.id), doc);
      toast.success(decision === 'approve' ? 'Return approved — stock and party balance updated' : 'Return rejected');
    },
    onError: (err) => toast.error(apiError(err, 'Could not update approval')),
  });
}

export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; delivery_status: DeliveryStatus; delivered_date?: string; tracking_number?: string; courier_name?: string }) => {
      const { data } = await apiClient.patch<ApiResponse<BillingDocument>>(`/documents/${id}/delivery`, body);
      return data.data!;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.setQueryData(documentKeys.detail(doc.id), doc);
      toast.success('Delivery status updated');
    },
    onError: (err) => toast.error(apiError(err, 'Could not update delivery')),
  });
}

export function useSendDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<BillingDocument>>(`/documents/${id}/send`);
      return data.data!;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.setQueryData(documentKeys.detail(doc.id), doc);
      toast.success('Emailed to the party');
    },
    onError: (err) => toast.error(apiError(err, 'Could not send email')),
  });
}

export function useDownloadDocumentPdf() {
  return useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const response = await apiClient.get(`/documents/${id}/download-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('PDF downloaded'),
    onError: async (err: any) => {
      let message = 'Could not download the PDF';
      try {
        const text = await err.response?.data?.text?.();
        if (text) message = JSON.parse(text)?.error?.message || message;
      } catch { /* keep default */ }
      toast.error(message);
    },
  });
}
