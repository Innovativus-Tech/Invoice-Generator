'use client';

import { Suspense } from 'react';
import { notFound, useParams } from 'next/navigation';
import { DocumentEditorPage } from '@/components/documents/document-editor-page';
import { docTypeFromSlug } from '@/lib/doc-types';

export default function NewDocumentPage() {
  const { type: slug } = useParams<{ type: string }>();
  const type = docTypeFromSlug(slug);
  if (!type) notFound();
  return (
    <Suspense>
      <DocumentEditorPage key={type} type={type} />
    </Suspense>
  );
}
