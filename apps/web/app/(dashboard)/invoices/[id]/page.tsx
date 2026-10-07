'use client';

import { useParams } from 'next/navigation';
import { DocumentDetailPage } from '@/components/documents/document-detail-page';

// Also resolves notification / search links for every other document type.
export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <DocumentDetailPage type="sales_invoice" id={id} />;
}
