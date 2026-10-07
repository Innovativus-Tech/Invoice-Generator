'use client';

import { Suspense } from 'react';
import { notFound, useParams } from 'next/navigation';
import { DocumentListPage } from '@/components/documents/document-list-page';
import { docTypeFromSlug } from '@/lib/doc-types';

export default function DocumentsPage() {
  const { type: slug } = useParams<{ type: string }>();
  const type = docTypeFromSlug(slug);
  if (!type) notFound();
  return (
    <Suspense>
      <DocumentListPage key={type} type={type} />
    </Suspense>
  );
}
