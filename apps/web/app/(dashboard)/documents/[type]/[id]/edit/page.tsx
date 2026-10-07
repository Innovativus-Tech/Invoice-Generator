'use client';

import { Suspense } from 'react';
import { notFound, useParams } from 'next/navigation';
import { DocumentEditorPage } from '@/components/documents/document-editor-page';
import { docTypeFromSlug } from '@/lib/doc-types';

export default function EditDocumentPage() {
  const { type: slug, id } = useParams<{ type: string; id: string }>();
  const type = docTypeFromSlug(slug);
  if (!type) notFound();
  return (
    <Suspense>
      <DocumentEditorPage type={type} id={id} />
    </Suspense>
  );
}
