'use client';

import { Suspense } from 'react';
import { DocumentListPage } from '@/components/documents/document-list-page';

export default function InvoicesPage() {
  return (
    <Suspense>
      <DocumentListPage type="sales_invoice" />
    </Suspense>
  );
}
