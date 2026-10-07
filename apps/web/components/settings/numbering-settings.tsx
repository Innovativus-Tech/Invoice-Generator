'use client';

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNumbering, useUpdateNumbering } from '@/hooks/use-settings';
import { DOC_TYPES, docUi } from '@/lib/doc-types';
import type { NumberSeries } from '@/types';

const ORDER: NumberSeries['doc_type'][] = [...DOC_TYPES, 'payment_in', 'payment_out'];
const LABEL = (t: NumberSeries['doc_type']) =>
  t === 'payment_in' ? 'Payment receipt' : t === 'payment_out' ? 'Payment voucher' : docUi(t).label;

function preview(row: NumberSeries) {
  const year = new Date().getFullYear();
  return row.include_year ? `${row.prefix}-${year}-${row.next_number}` : `${row.prefix}-${row.next_number}`;
}

/** Each document type has its own number series (estimate numbers never use up bill numbers). */
export function NumberingSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useNumbering();
  const update = useUpdateNumbering();
  const [rows, setRows] = useState<NumberSeries[]>([]);

  useEffect(() => {
    if (data) setRows([...data].sort((a, b) => ORDER.indexOf(a.doc_type) - ORDER.indexOf(b.doc_type)));
  }, [data]);

  const set = (i: number, patch: Partial<NumberSeries>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const dirty = rows.some((r) => {
    const orig = data?.find((d) => d.doc_type === r.doc_type);
    return orig && (orig.prefix !== r.prefix || orig.next_number !== r.next_number || orig.include_year !== r.include_year);
  });

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-1">Document numbering</h3>
          <p className="text-sm text-text-2 mt-1">
            Every document type has its own series — estimates, challans and sales bills are numbered separately.
            Numbers are given out when a document is saved, so two people billing at once never get the same number.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => update.mutate(rows.map(({ doc_type, prefix, next_number, include_year }) => ({ doc_type, prefix, next_number, include_year })))}
            loading={update.isPending}
            disabled={!dirty}
            icon={<Save className="h-4 w-4" />}
          >
            Save numbering
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                <th className="py-2 pr-4 text-left">Document</th>
                <th className="py-2 px-2 text-left">Prefix</th>
                <th className="py-2 px-2 text-left">Next number</th>
                <th className="py-2 px-2 text-center">Include year</th>
                <th className="py-2 pl-4 text-left">Next will be</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={row.doc_type}>
                  <td className="py-2 pr-4 text-text-1">{LABEL(row.doc_type)}</td>
                  <td className="py-2 px-2">
                    <input
                      value={row.prefix}
                      disabled={!canEdit}
                      maxLength={12}
                      onChange={(e) => set(i, { prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9/_-]/g, '') })}
                      className="w-28 h-9 rounded-md border border-border bg-white px-2 font-mono text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card disabled:opacity-60"
                      aria-label={`${LABEL(row.doc_type)} prefix`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={1}
                      value={row.next_number}
                      disabled={!canEdit}
                      onChange={(e) => set(i, { next_number: Math.max(parseInt(e.target.value, 10) || 1, 1) })}
                      className="w-28 h-9 rounded-md border border-border bg-white px-2 font-mono text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card disabled:opacity-60"
                      aria-label={`${LABEL(row.doc_type)} next number`}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.include_year}
                      disabled={!canEdit}
                      onChange={(e) => set(i, { include_year: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-primary"
                      aria-label={`${LABEL(row.doc_type)} include year`}
                    />
                  </td>
                  <td className="py-2 pl-4 font-mono text-text-2">{preview(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
