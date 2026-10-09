'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBindingRates, useSaveBindingRates } from '@/hooks/use-binding-rates';
import { usePermissions } from '@/hooks/use-permissions';
import type { BindingRate } from '@/types';

const inputCls =
  'h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card disabled:opacity-60';

/** Rate card: what each binding type costs per copy. Purchase lines pre-fill from it. */
export function BindingRatesCard() {
  const { data, isLoading } = useBindingRates();
  const save = useSaveBindingRates();
  const { can } = usePermissions();
  const canEdit = can('purchases', 'update');
  const [rows, setRows] = useState<BindingRate[]>([]);

  useEffect(() => {
    if (data) setRows(data.map((r) => ({ name: r.name, charge: r.charge })));
  }, [data]);

  const set = (i: number, patch: Partial<BindingRate>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const dirty = JSON.stringify(rows) !== JSON.stringify((data ?? []).map((r) => ({ name: r.name, charge: r.charge })));

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-text-1">Binding rate card</h3>
          <p className="text-sm text-text-2 mt-1">
            Charge per copy for each binding type. When you pick a binding on a purchase line, its charge is filled in from here
            (you can still change it on the bill). Line amount = quantity × (book rate + binding charge).
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => save.mutate(rows.filter((r) => r.name.trim()))} loading={save.isPending} disabled={!dirty} icon={<Save className="h-4 w-4" />}>
            Save rates
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : (
        <div className="max-w-xl">
          <div className="grid grid-cols-[1fr_160px_40px] gap-2 text-xs font-medium uppercase tracking-wider text-text-2 pb-2 border-b border-border">
            <span>Binding type</span>
            <span className="text-right">Charge / copy (₹)</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_160px_40px] gap-2 py-2 items-center">
                <input
                  value={row.name}
                  disabled={!canEdit}
                  onChange={(e) => set(i, { name: e.target.value })}
                  placeholder="e.g. Paperback"
                  className={inputCls}
                  aria-label="Binding type"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.charge === 0 ? '' : row.charge}
                  placeholder="0"
                  disabled={!canEdit}
                  onChange={(e) => set(i, { charge: Math.max(parseFloat(e.target.value) || 0, 0) })}
                  className={`${inputCls} text-right`}
                  aria-label={`${row.name || 'Binding'} charge per copy`}
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                    className="p-2 rounded text-text-2 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label={`Remove ${row.name || 'row'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRows((r) => [...r, { name: '', charge: 0 }])} icon={<Plus className="h-4 w-4" />}>
              Add binding type
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
