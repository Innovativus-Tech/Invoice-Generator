'use client';

import { notFound, useParams } from 'next/navigation';
import { DocumentDetailPage } from '@/components/documents/document-detail-page';
import { docTypeFromSlug } from '@/lib/doc-types';

export default function DocumentPage() {
  const { type: slug, id } = useParams<{ type: string; id: string }>();
  const type = docTypeFromSlug(slug);
  if (!type) notFound();
  return <DocumentDetailPage type={type} id={id} />;
}
