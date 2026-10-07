'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonInvoiceForm } from '@/components/ui/skeleton';
import { DocumentForm, type SaveIntent } from './document-form';
import { DocumentPreview } from './document-preview';
import { useClients } from '@/hooks/use-clients';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { useCreateDocument, useDocument, useNextDocNumber, useSendDocument, useUpdateDocument } from '@/hooks/use-documents';
import { docPath, docUi, newDocPath } from '@/lib/doc-types';
import { convertDocument, documentToFormValues, emptyDocument, partyFields } from '@/lib/document-defaults';
import type { DocType, DocumentFormValues } from '@/types';

interface DocumentEditorPageProps {
  type: DocType;
  /** Present when editing an existing document. */
  id?: string;
}

export function DocumentEditorPage({ type, id }: DocumentEditorPageProps) {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = id ? null : params.get('from');
  const presetClient = id ? null : params.get('client');
  const ui = docUi(type);
  const { can } = usePermissions();

  const { data: existing, isLoading: loadingExisting } = useDocument(id);
  const { data: source, isLoading: loadingSource } = useDocument(fromId);
  const { data: nextNumber, isLoading: loadingNumber } = useNextDocNumber(type);
  const { data: parties, isLoading: loadingParties } = useClients();
  const { data: settings } = useSettings();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const sendDoc = useSendDocument();
  const [preview, setPreview] = useState<DocumentFormValues | null>(null);
  const [formKey, setFormKey] = useState(0);

  const ready = !loadingParties && (id ? !loadingExisting : !loadingNumber && (!fromId || !loadingSource));

  const defaults = useMemo<DocumentFormValues | null>(() => {
    if (!ready) return null;
    if (id) return existing ? documentToFormValues(existing) : null;
    let values = source ? convertDocument(source, type) : emptyDocument(type);
    values = { ...values, invoice_number: nextNumber ?? '' };
    const party = presetClient ? parties?.find((p) => p.id === presetClient) : null;
    if (party) values = { ...values, ...partyFields(type, party, values.issue_date) };
    return values;
    // formKey forces fresh defaults after "Save & New".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id, existing, source, type, nextNumber, presetClient, parties, formKey]);

  const handlePreview = useCallback((v: DocumentFormValues) => setPreview(v), []);

  const wrongType = !!existing && existing.doc_type !== type;
  useEffect(() => {
    if (existing && wrongType) router.replace(docPath(existing.doc_type, existing.id, 'edit'));
  }, [existing, wrongType, router]);
  if (wrongType) return null;

  const handleSubmit = async (values: DocumentFormValues, intent: SaveIntent) => {
    if (id) {
      const doc = await updateDoc.mutateAsync({ id, values });
      if (intent === 'send') await sendDoc.mutateAsync(doc.id).catch(() => {});
      router.push(docPath(type, doc.id));
      return;
    }
    // An untouched suggested number is allocated by the server inside the save
    // transaction, so two people billing at the same time never collide.
    const payload = values.invoice_number === nextNumber ? { ...values, invoice_number: '' } : values;
    const doc = await createDoc.mutateAsync({ type, values: payload });
    if (intent === 'send') await sendDoc.mutateAsync(doc.id).catch(() => {});
    if (intent === 'save_new') {
      setPreview(null);
      setFormKey((k) => k + 1);
      router.replace(newDocPath(type));
      return;
    }
    router.push(docPath(type, doc.id));
  };

  const previewParty = parties?.find((p) => p.id === preview?.client_id) ?? null;
  const sourceDoc = existing?.source_doc ?? source ?? null;
  const sourceNumber = previewSourceNumber(preview?.source_doc_id, existing, source);
  const title = id
    ? `Edit ${ui.label}`
    : source
      ? `New ${ui.label} from ${docUi(source.doc_type).label} ${source.invoice_number}`
      : `New ${ui.label}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(id ? docPath(type, id) : docPath(type))} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-text-1">
            {title} {id && existing && <span className="font-mono">{existing.invoice_number}</span>}
          </h1>
          <p className="text-sm text-text-2 mt-0.5">{ui.description}</p>
        </div>
      </div>

      {!defaults ? (
        <SkeletonInvoiceForm />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <DocumentForm
              key={id ?? `new-${formKey}-${nextNumber}`}
              type={type}
              defaultValues={defaults}
              parties={parties ?? []}
              isEdit={!!id}
              sourceDoc={sourceDoc}
              canSend={can(ui.resource, 'send')}
              onSubmit={handleSubmit}
              onPreviewChange={handlePreview}
            />
          </div>
          <div className="xl:col-span-2 hidden xl:block">
            <div className="sticky top-20">
              <DocumentPreview
                type={type}
                formData={preview ?? defaults}
                profile={settings}
                party={previewParty}
                sourceNumber={sourceNumber}
                amountPaid={existing?.amount_paid ?? 0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function previewSourceNumber(
  sourceId: string | null | undefined,
  existing: { source_doc?: { id: string; invoice_number: string } | null } | undefined,
  source: { id: string; invoice_number: string } | undefined
) {
  if (!sourceId) return null;
  if (existing?.source_doc?.id === sourceId) return existing.source_doc.invoice_number;
  if (source?.id === sourceId) return source.invoice_number;
  return null;
}
