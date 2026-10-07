'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Hand, Package, Truck, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { COURIER_OPTIONS, DELIVERY_STATUS } from '@/lib/doc-types';
import type { DeliveryStatus, DispatchMode, DocumentFormValues } from '@/types';

const selectCls =
  'w-full h-10 rounded-md border border-border bg-white px-3 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card';

export function DispatchCard() {
  const { register, setValue } = useFormContext<DocumentFormValues>();
  const [mode, freight, delivery] = useWatch<DocumentFormValues>({ name: ['dispatch_mode', 'freight_type', 'delivery_type'] }) as [
    DispatchMode,
    DocumentFormValues['freight_type'],
    DocumentFormValues['delivery_type'],
  ];

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Dispatch & delivery</h3>
        <Segmented<DispatchMode>
          size="sm"
          ariaLabel="Dispatch mode"
          value={mode ?? 'none'}
          onChange={(m) => setValue('dispatch_mode', m, { shouldDirty: true })}
          options={[
            { value: 'none', label: 'None', icon: <Ban className="h-3.5 w-3.5" /> },
            { value: 'courier', label: 'Courier / Post', icon: <Package className="h-3.5 w-3.5" /> },
            { value: 'transport', label: 'Transport', icon: <Truck className="h-3.5 w-3.5" /> },
            { value: 'hand', label: 'By hand', icon: <Hand className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      {mode === 'none' && <p className="text-sm text-text-2">Choose how the books are being sent to record tracking, cartons and freight.</p>}

      {mode === 'courier' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input label="Courier company" list="courier-options" placeholder="DTDC, India Post…" {...register('courier_name')} />
            <datalist id="courier-options">
              {COURIER_OPTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <Input label="Tracking / AWB / Consignment no." className="font-mono" {...register('tracking_number')} />
        </div>
      )}

      {mode === 'transport' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Transport name" placeholder="e.g. VRL Logistics" {...register('transport_name')} />
            <Input label="LR / GR / Bilty no." className="font-mono" {...register('lr_number')} />
            <Input label="Vehicle no." className="font-mono uppercase" {...register('vehicle_number')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <Input label="No. of cartons / bundles" type="number" min={0} {...register('cartons', { setValueAs: (v) => (v === '' || v === null ? null : parseInt(v, 10)) })} />
            <div>
              <span className="block text-sm font-medium text-text-1 mb-1.5">Freight</span>
              <Segmented<'paid' | 'to_pay' | ''>
                size="sm"
                ariaLabel="Freight"
                value={freight ?? ''}
                onChange={(val) => setValue('freight_type', val, { shouldDirty: true })}
                options={[{ value: 'paid', label: 'Paid' }, { value: 'to_pay', label: 'To pay (unpaid)' }]}
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-text-1 mb-1.5">Delivery</span>
              <Segmented<'door' | 'godown' | ''>
                size="sm"
                ariaLabel="Delivery type"
                value={delivery ?? ''}
                onChange={(val) => setValue('delivery_type', val, { shouldDirty: true })}
                options={[{ value: 'door', label: 'Door delivery' }, { value: 'godown', label: 'Godown' }]}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-1 mb-1.5">Other transport details</label>
            <input placeholder="Weight, booking station, private marks…" {...register('transport_details')} className={selectCls} />
          </div>
        </div>
      )}

      {mode !== 'none' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <Input label="Dispatch date" type="date" {...register('dispatch_date')} />
          <Input label="Expected delivery" type="date" {...register('expected_delivery_date')} />
          <div>
            <label className="block text-sm font-medium text-text-1 mb-1.5">Status</label>
            <select {...register('delivery_status')} className={selectCls}>
              {(Object.keys(DELIVERY_STATUS) as DeliveryStatus[]).map((s) => (
                <option key={s} value={s}>{DELIVERY_STATUS[s].label}</option>
              ))}
            </select>
          </div>
          <Input label="Delivered on" type="date" {...register('delivered_date')} />
        </div>
      )}
    </Card>
  );
}
