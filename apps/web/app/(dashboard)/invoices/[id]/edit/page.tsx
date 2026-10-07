'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DocumentEditorPage } from '@/components/documents/document-editor-page';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <DocumentEditorPage type="sales_invoice" id={id} />
    </Suspense>
  );
}
