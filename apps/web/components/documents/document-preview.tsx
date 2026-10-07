'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { docUi } from '@/lib/doc-types';
import { computeTotals, gstRateOf, lineAmount } from '@/lib/totals';
import { convertToIndianWords, formatGstDate, formatIndianCurrency } from '@/lib/utils';
import type { Client, DocType, DocumentFormValues, Profile } from '@/types';

// Mirrors the PDF layout in apps/api/src/services/pdf.service.ts.

const TEAL = '#0E7490';
const NAVY = '#1E293B';
const BORDER = '#CBD5E1';
const GRAY = '#64748B';

const TITLE: Record<DocType, string> = {
  sales_invoice: 'Tax Invoice',
  estimate: 'Estimate',
  delivery_challan: 'Delivery Challan',
  sales_return: 'Sales Return / Credit Note',
  credit_note: 'Credit Note',
  purchase_bill: 'Purchase Bill',
  purchase_return: 'Purchase Return / Debit Note',
  debit_note: 'Debit Note',
  binding_order: 'Binding Order',
};

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface DocumentPreviewProps {
  type: DocType;
  formData: DocumentFormValues | null;
  profile?: Profile | null;
  party?: Client | null;
  sourceNumber?: string | null;
  amountPaid?: number;
  loading?: boolean;
}

const p = (style: React.CSSProperties = {}) => ({ fontSize: '8px', color: '#374151', ...style });

export function DocumentPreview({ type, formData, profile, party, sourceNumber, amountPaid = 0, loading }: DocumentPreviewProps) {
  const [logo, setLogo] = React.useState<string | null>(null);
  const [signature, setSignature] = React.useState<string | null>(null);
  const ui = docUi(type);

  React.useEffect(() => {
    if (profile?.logo_url) fetchImageAsBase64(profile.logo_url).then(setLogo);
    if (profile?.signature_url) fetchImageAsBase64(profile.signature_url).then(setSignature);
  }, [profile?.logo_url, profile?.signature_url]);

  if (loading || !formData) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const d = formData;
  const items = d.items || [];
  const t = computeTotals({
    items: items.map((i) => ({ quantity: i?.quantity || 0, unit_price: i?.unit_price || 0, discount_percent: i?.discount_percent, gst_rate: i?.gst_rate })),
    extra_discount_type: d.extra_discount_type,
    extra_discount_value: d.extra_discount_value,
    postage_charge: d.postage_charge,
    other_charges: d.other_charges,
    apply_round_off: d.apply_round_off,
  });
  const rates = Array.from(new Set(items.map((i) => gstRateOf(i?.gst_rate))));
  const rateLabel = rates.length === 1 ? `${rates[0]}%` : 'mixed';
  const halfLabel = rates.length === 1 ? `${rates[0] / 2}%` : 'mixed';
  const fmt = formatIndianCurrency;
  const biz = profile?.business_name || 'Your Business';
  const showBook = profile?.show_book_metadata ?? false;
  const isCash = ui.isBill && d.payment_mode === 'cash';
  const partyName = party?.name || d.party_name || (isCash ? 'Cash' : `Select a ${ui.partyLabel.toLowerCase()}`);
  const showShipTo = !!d.shipping_address && d.shipping_address.trim() !== (d.billing_address ?? '').trim();
  const showGst = t.tax > 0 || type === 'sales_invoice';
  const showPaid = ui.isBill && !isCash && amountPaid > 0;

  const meta: [string, string][] = [
    [ui.numberLabel.replace('Invoice No.', 'Bill No.'), (type === 'sales_invoice' && d.bill_number) || d.invoice_number || '(auto)'],
    ['Date', d.issue_date ? formatGstDate(d.issue_date) : '—'],
  ];
  if (ui.isBill) {
    meta.push(['Payment', isCash ? 'Cash' : `Credit${d.credit_days ? ` (${d.credit_days} days)` : ''}`]);
    if (!isCash && d.due_date) meta.push(['Due Date', formatGstDate(d.due_date)]);
  }
  if (type === 'estimate' && d.valid_until) meta.push(['Valid Until', formatGstDate(d.valid_until)]);
  if (sourceNumber) meta.push([ui.isBill ? 'Ref' : 'Against', sourceNumber]);
  if (d.party_ref_number) meta.push([ui.side === 'purchase' ? 'Supplier Bill No.' : 'Party Ref', d.party_ref_number]);
  if (d.order_id) meta.push(['Order ID', d.order_id]);

  const remarks =
    type === 'estimate' ? `This is an estimate (approximate bill), not a tax invoice. Prices are approximate and may change${d.valid_until ? `; valid until ${formatGstDate(d.valid_until)}` : ''}.`
    : type === 'delivery_challan' ? 'Goods sent under delivery challan. This is not a tax invoice.'
    : type === 'binding_order' ? 'Please bind and deliver the above titles. Rates are per copy.'
    : d.reason ? `Reason: ${d.reason}` : null;

  const dispatch: string[] = [];
  if (d.dispatch_mode === 'courier') {
    dispatch.push([`Courier: ${d.courier_name || '—'}`, d.tracking_number && `Tracking / AWB: ${d.tracking_number}`, d.dispatch_date && `Dispatched: ${formatGstDate(d.dispatch_date)}`].filter(Boolean).join('  ·  '));
  } else if (d.dispatch_mode === 'transport') {
    dispatch.push([`Transport: ${d.transport_name || '—'}`, d.lr_number && `LR / GR No.: ${d.lr_number}`, d.vehicle_number && `Vehicle: ${d.vehicle_number}`].filter(Boolean).join('  ·  '));
    const second = [
      d.cartons != null && !Number.isNaN(d.cartons) && `Cartons: ${d.cartons}`,
      d.freight_type && `Freight: ${d.freight_type === 'paid' ? 'Paid' : 'To Pay (unpaid)'}`,
      d.delivery_type && (d.delivery_type === 'door' ? 'Door Delivery' : 'Godown Delivery'),
      d.transport_details,
    ].filter(Boolean).join('  ·  ');
    if (second) dispatch.push(second);
  } else if (d.dispatch_mode === 'hand') {
    dispatch.push('Delivered by hand');
  }

  const totalRow = (label: string, value: string, bold = false) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
      <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: bold ? '9px' : '8px', fontWeight: bold ? 'bold' : 'normal', color: bold ? NAVY : '#374151' }}>{label}</span>
      <span style={{ width: '90px', textAlign: 'right', fontSize: bold ? '9px' : '8px', fontWeight: bold ? 'bold' : 'normal', color: bold ? NAVY : '#111827' }}>{value}</span>
    </div>
  );

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-surface dark:bg-[#0F0E17] px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-text-2">Live Preview · {ui.label}</span>
        <span className="text-xs text-text-2">A4</span>
      </div>

      <div className="p-4 overflow-auto max-h-[calc(100vh-200px)]">
        <div className="origin-top-left transform scale-[0.68]" style={{ width: '595px', minHeight: '842px' }}>
          <div className="bg-white" style={{ width: '595px', minHeight: '842px', padding: '30px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ height: '3px', backgroundColor: TEAL, marginBottom: '10px' }} />

            {/* Header */}
            <div style={{ display: 'flex', marginBottom: '12px' }}>
              <div style={{ width: '60%' }}>
                {(logo || profile?.logo_url) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo || profile?.logo_url || undefined} alt="Logo" style={{ width: '70px', height: '70px', objectFit: 'contain', marginBottom: '6px' }} />
                )}
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: NAVY, marginBottom: '3px' }}>{biz}</p>
                {profile?.business_address && <p style={p({ color: GRAY })}>Add: {profile.business_address}</p>}
                {profile?.business_phone && <p style={p({ color: GRAY })}>Phone: {profile.business_phone}</p>}
                {profile?.business_email && <p style={p({ color: GRAY })}>{profile.business_email}</p>}
                {profile?.gstin && <p style={p({ color: GRAY })}>GSTIN: {profile.gstin}</p>}
              </div>
              <div style={{ width: '40%', textAlign: 'right' }}>
                <p style={{ fontSize: TITLE[type].length > 14 ? '16px' : '22px', fontWeight: 'bold', color: NAVY, marginBottom: '6px' }}>{TITLE[type]}</p>
                {meta.map(([label, value]) => (
                  <p key={label} style={p({ marginBottom: '3px' })}><strong>{label}: </strong>{value}</p>
                ))}
              </div>
            </div>

            {/* Party */}
            <div style={{ display: 'flex', marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: '60%' }}>
                <p style={{ fontSize: '7px', fontWeight: 'bold', color: GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                  {type === 'binding_order' ? 'Binder' : ui.side === 'purchase' ? 'Supplier' : 'Bill To'}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: NAVY, marginBottom: '2px' }}>{partyName}</p>
                {party?.company && <p style={p()}>{party.company}</p>}
                {party?.gstin && <p style={p()}>GSTIN: {party.gstin}</p>}
                {d.billing_address && <p style={p({ whiteSpace: 'pre-line' })}>{d.billing_address}</p>}
                {party?.state && <p style={p()}>State: {party.state}{party.state_code ? ` (${party.state_code})` : ''}</p>}
                {(d.party_phone || party?.phone) && <p style={p()}>Phone: {d.party_phone || party?.phone}</p>}
              </div>
              <div style={{ width: '40%', textAlign: showShipTo ? 'left' : 'right' }}>
                {showShipTo && (
                  <>
                    <p style={{ fontSize: '7px', fontWeight: 'bold', color: GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Ship To</p>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', color: NAVY, marginBottom: '2px' }}>{d.shipping_name || partyName}</p>
                    <p style={p({ whiteSpace: 'pre-line' })}>{d.shipping_address}</p>
                  </>
                )}
                {d.place_of_supply && <p style={p({ marginTop: showShipTo ? '4px' : 0 })}><strong>Place of Supply: </strong>{d.place_of_supply}</p>}
              </div>
            </div>

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
              <thead>
                <tr style={{ backgroundColor: NAVY, color: '#FFFFFF' }}>
                  {['SI No.', 'Description', 'HSN', 'GST', 'Qty', 'Rate', 'Disc.', 'Amount'].map((h, i) => (
                    <th key={h} style={{ padding: '5px 4px', fontSize: '7px', fontWeight: 'bold', textAlign: i === 1 ? 'left' : i >= 5 && i !== 6 ? 'right' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const disc = item.discount_percent ?? 0;
                  return (
                    <tr key={idx} style={{ borderBottom: `0.5px solid ${BORDER}`, borderLeft: `0.5px solid ${BORDER}`, borderRight: `0.5px solid ${BORDER}` }}>
                      <td style={{ padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '4px' }}>
                        <div>{item.description || '—'}</div>
                        {showBook && item.isbn && <div style={{ fontSize: '7px', color: GRAY }}>ISBN: {item.isbn}</div>}
                        {showBook && item.author && <div style={{ fontSize: '7px', color: GRAY }}>Author: {item.author}</div>}
                        {item.binding && <div style={{ fontSize: '7px', color: GRAY }}>Binding: {item.binding}</div>}
                        {(item.damaged_qty ?? 0) > 0 && ui.tracksDamage && <div style={{ fontSize: '7px', color: '#B91C1C' }}>Damaged: {item.damaged_qty}</div>}
                      </td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>{item.hsn_sac || ''}</td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>{gstRateOf(item.gst_rate)}%</td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '4px', textAlign: 'right' }}>{fmt(item.unit_price || 0)}</td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>{disc > 0 ? `${disc}%` : '–'}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{fmt(lineAmount(item))}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '12px', color: GRAY }}>No items added</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ border: `0.5px solid ${BORDER}` }}>
              {totalRow('Subtotal:', fmt(t.subtotal))}
              {t.extraDiscount > 0 && totalRow(`Extra Discount${d.extra_discount_type === 'percent' ? ` (${d.extra_discount_value}%)` : ''}:`, `- ${fmt(t.extraDiscount)}`)}
              {t.extraDiscount > 0 && totalRow('Taxable Value:', fmt(t.taxable))}
              {showGst && (d.supply_type === 'CGST_SGST'
                ? <>{totalRow(`CGST (${halfLabel}):`, fmt(t.tax / 2))}{totalRow(`SGST (${halfLabel}):`, fmt(t.tax / 2))}</>
                : totalRow(`IGST (${rateLabel}):`, fmt(t.tax)))}
              {(d.postage_charge ?? 0) > 0 && totalRow('Postage / Delivery Charges:', fmt(d.postage_charge))}
              {(d.other_charges ?? 0) > 0 && totalRow(`${d.other_charges_label || 'Other Charges'}:`, fmt(d.other_charges))}
              {t.roundOff !== 0 && totalRow('Round Off:', `${t.roundOff > 0 ? '+' : '-'} ${fmt(Math.abs(t.roundOff))}`)}
              {totalRow(t.tax > 0 ? 'Total Amount (with Tax):' : 'Total Amount:', fmt(t.total), true)}
              {showPaid && totalRow('Amount Paid:', fmt(amountPaid))}
              {showPaid && totalRow('Balance Due:', fmt(Math.max(t.total - amountPaid, 0)), true)}
              <div style={{ padding: '6px 8px' }}>
                <span style={p({ color: '#111827' })}><strong>Total Amount in Words: </strong>{convertToIndianWords(t.total)}</span>
              </div>
            </div>

            {remarks && <p style={p({ fontStyle: 'italic', color: '#475569', marginTop: '8px' })}>{remarks}</p>}
            {dispatch.length > 0 && (
              <div style={{ marginTop: '8px', border: `0.5px solid ${BORDER}`, backgroundColor: '#F8FAFC', padding: '5px' }}>
                <p style={p({ fontWeight: 'bold', color: NAVY })}>Dispatch Details</p>
                {dispatch.map((line) => <p key={line} style={p()}>{line}</p>)}
              </div>
            )}

            {/* Bank + signature */}
            <div style={{ display: 'flex', marginTop: '14px' }}>
              <div style={{ width: '55%', paddingRight: '12px' }}>
                {d.notes && (
                  <div style={{ marginBottom: '8px' }}>
                    <p style={p({ fontWeight: 'bold', color: NAVY, marginBottom: '4px' })}>Notes:</p>
                    <p style={p({ whiteSpace: 'pre-line' })}>{d.notes}</p>
                  </div>
                )}
                {ui.side === 'sales' && (profile?.bank_name || profile?.bank_account_number) && (
                  <div>
                    <p style={p({ fontWeight: 'bold', color: NAVY, marginBottom: '4px' })}>Bank Details:</p>
                    {profile?.bank_name && <p style={p()}>Bank Name: {profile.bank_name}</p>}
                    {profile?.bank_account_number && <p style={p()}>Account No: {profile.bank_account_number}</p>}
                    {profile?.bank_ifsc && <p style={p()}>IFSC: {profile.bank_ifsc}</p>}
                    {profile?.bank_branch && <p style={p()}>Branch: {profile.bank_branch}</p>}
                  </div>
                )}
              </div>
              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <p style={p({ color: NAVY, marginBottom: '6px' })}>For {biz}</p>
                {(signature || profile?.signature_url) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={signature || profile?.signature_url || undefined} alt="Signature" style={{ width: '120px', height: '50px', objectFit: 'contain' }} />
                )}
                <div style={{ borderBottom: '0.5px solid #000', width: '140px', margin: '4px 0' }} />
                <p style={p({ color: GRAY })}>Authorized Signatory</p>
                {profile?.signatory_name && <p style={p({ fontWeight: 'bold', color: NAVY })}>{profile.signatory_name}</p>}
              </div>
            </div>

            {profile?.gstin && (
              <p style={{ fontSize: '8px', fontWeight: 'bold', textAlign: 'center', color: NAVY, marginTop: '10px' }}>GSTIN: {profile.gstin}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
