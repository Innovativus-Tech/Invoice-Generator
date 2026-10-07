'use client';

import { Suspense } from 'react';
import { DocumentEditorPage } from '@/components/documents/document-editor-page';

export default function NewInvoicePage() {
  return (
    <Suspense>
      <DocumentEditorPage type="sales_invoice" />
    </Suspense>
  );
}
