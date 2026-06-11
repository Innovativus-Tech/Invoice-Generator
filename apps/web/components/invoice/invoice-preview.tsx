'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGstDate, calculateGstTotals, formatIndianCurrency, formatCurrency, convertToIndianWords } from '@/lib/utils';
import type { InvoiceFormValues, Profile, Client, SupplyType } from '@/types';

interface InvoicePreviewProps {
  formData: InvoiceFormValues | null;
  profile?: Profile | null;
  client?: Client | null;
  loading?: boolean;
}

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

const TEAL = '#0E7490';
const NAVY = '#1E293B';
const BORDER = '#CBD5E1';
const GRAY = '#64748B';

export function InvoicePreview({ formData, profile, client, loading }: InvoicePreviewProps) {
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [signatureBase64, setSignatureBase64] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (profile?.logo_url) fetchImageAsBase64(profile.logo_url).then(setLogoBase64);
    if (profile?.signature_url) fetchImageAsBase64(profile.signature_url).then(setSignatureBase64);
  }, [profile?.logo_url, profile?.signature_url]);

  if (loading || !formData) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-48 ml-auto" />
      </div>
    );
  }

  const items = formData.items || [];
  const supplyType: SupplyType = formData.supply_type || 'IGST';
  const { subtotal, totalGst, total } = calculateGstTotals(
    items.map(i => ({
      quantity: i?.quantity || 0,
      unit_price: i?.unit_price || 0,
      gst_rate: i?.gst_rate ?? 18,
      discount_percent: i?.discount_percent ?? 0,
    }))
  );

  const displayRate = items[0]?.gst_rate ?? 18;
  const halfRate = displayRate / 2;
  const currency = profile?.currency || 'INR';
  const isInr = currency === 'INR';
  const fmt = (n: number) => isInr ? formatIndianCurrency(n) : formatCurrency(n, currency);

  const biz = profile?.business_name || 'Your Business';

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Preview label */}
      <div className="bg-surface dark:bg-[#0F0E17] px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-text-2">Live Preview</span>
        <span className="text-xs text-text-2">A4</span>
      </div>

      {/* Scaled preview */}
      <div className="p-4 overflow-auto max-h-[calc(100vh-200px)]">
        <div className="origin-top-left transform scale-[0.68]" style={{ width: '595px', minHeight: '842px' }}>
          <div className="bg-white" style={{ width: '595px', minHeight: '842px', padding: '30px', fontFamily: 'Arial, sans-serif' }}>

            {/* Top teal border */}
            <div style={{ height: '3px', backgroundColor: TEAL, marginBottom: '10px' }} />

            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'row', marginBottom: '12px' }}>
              {/* Left */}
              <div style={{ width: '60%' }}>
                {(logoBase64 || profile?.logo_url) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoBase64 || profile?.logo_url || undefined} alt="Logo" style={{ width: '70px', height: '70px', objectFit: 'contain', marginBottom: '6px' }} />
                )}
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: NAVY, marginBottom: '3px' }}>{biz}</p>
                {profile?.business_address && <p style={{ fontSize: '8px', color: GRAY }}>Add: {profile.business_address}</p>}
                {profile?.business_phone && <p style={{ fontSize: '8px', color: GRAY }}>Phone: {profile.business_phone}</p>}
                {profile?.business_email && <p style={{ fontSize: '8px', color: GRAY }}>{profile.business_email}</p>}
                {profile?.website && <p style={{ fontSize: '8px', color: GRAY }}>{profile.website}</p>}
                {profile?.gstin && <p style={{ fontSize: '8px', color: GRAY }}>GSTIN: {profile.gstin}</p>}
              </div>
              {/* Right */}
              <div style={{ width: '40%', textAlign: 'right' as const }}>
                <p style={{ fontSize: '22px', fontWeight: 'bold', color: NAVY, marginBottom: '6px' }}>Invoice</p>
                <p style={{ fontSize: '8px', color: '#374151', marginBottom: '3px' }}>
                  <strong>Bill No.: </strong>{formData.bill_number || formData.invoice_number || '—'}
                </p>
                <p style={{ fontSize: '8px', color: '#374151', marginBottom: '3px' }}>
                  <strong>Date: </strong>{formData.issue_date ? formatGstDate(formData.issue_date) : '—'}
                </p>
                {formData.order_id && (
                  <p style={{ fontSize: '8px', color: '#374151', marginBottom: '3px' }}>
                    <strong>Order ID: </strong>{formData.order_id}
                  </p>
                )}
                {formData.order_date && (
                  <p style={{ fontSize: '8px', color: '#374151' }}>
                    <strong>Order Date: </strong>{formatGstDate(formData.order_date)}
                  </p>
                )}
              </div>
            </div>

            {/* Bill To */}
            <div style={{ display: 'flex', flexDirection: 'row', marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: '60%' }}>
                <p style={{ fontSize: '7px', fontWeight: 'bold', color: GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>To,</p>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: NAVY, marginBottom: '2px' }}>{client?.name || 'Select a client'}</p>
                {client?.company && <p style={{ fontSize: '8px', color: '#374151' }}>{client.company}</p>}
                {client?.gstin && <p style={{ fontSize: '8px', color: '#374151' }}>{client.gstin}</p>}
                {client?.address && <p style={{ fontSize: '8px', color: '#374151' }}>{client.address}</p>}
                {client?.state && (
                  <p style={{ fontSize: '8px', color: '#374151' }}>
                    State: {client.state}{client.state_code ? ` (${client.state_code})` : ''}
                  </p>
                )}
              </div>
              {formData.place_of_supply && (
                <div style={{ width: '40%', textAlign: 'right' as const }}>
                  <p style={{ fontSize: '8px', color: '#374151' }}>
                    <strong>Place of Supply: </strong>{formData.place_of_supply}
                  </p>
                </div>
              )}
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '0' }}>
              <thead>
                <tr style={{ backgroundColor: NAVY, color: '#FFFFFF' }}>
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '22px', fontSize: '7px', fontWeight: 'bold' }}>SI<br/>No.</th>
                  <th style={{ padding: '5px 4px', textAlign: 'left', width: '140px', fontSize: '7px', fontWeight: 'bold' }}>Description of Goods</th>
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '58px', fontSize: '7px', fontWeight: 'bold' }}>HSN/SAC</th>
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '34px', fontSize: '7px', fontWeight: 'bold' }}>GST<br/>Rate</th>
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '42px', fontSize: '7px', fontWeight: 'bold' }}>Quantity</th>
                  <th style={{ padding: '5px 4px', textAlign: 'right', width: '63px', fontSize: '7px', fontWeight: 'bold' }}>Rate per<br/>Pcs</th>
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '34px', fontSize: '7px', fontWeight: 'bold' }}>Disc.<br/>%</th>
                  <th style={{ padding: '5px 4px', textAlign: 'right', width: '68px', fontSize: '7px', fontWeight: 'bold' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const disc = item.discount_percent ?? 0;
                  const amount = (item.quantity || 0) * (item.unit_price || 0) * (1 - disc / 100);
                  const showBook = profile?.show_book_metadata ?? false;
                  return (
                    <tr key={idx} style={{ borderBottom: `0.5px solid ${BORDER}`, borderLeft: `0.5px solid ${BORDER}`, borderRight: `0.5px solid ${BORDER}` }}>
                      <td style={{ padding: '4px', textAlign: 'center', color: '#111827' }}>{idx}</td>
                      <td style={{ padding: '4px', color: '#111827' }}>
                        <div>{item.description || '—'}</div>
                        {showBook && item.isbn && <div style={{ fontSize: '7px', color: GRAY, marginTop: '1px' }}>ISBN: {item.isbn}</div>}
                        {showBook && item.author && <div style={{ fontSize: '7px', color: GRAY, marginTop: '1px' }}>Author: {item.author}</div>}
                      </td>
                      <td style={{ padding: '4px', textAlign: 'center', color: '#111827' }}>{item.hsn_sac || ''}</td>
                      <td style={{ padding: '4px', textAlign: 'center', color: '#111827' }}>{item.gst_rate == null ? '' : `${item.gst_rate}%`}</td>
                      <td style={{ padding: '4px', textAlign: 'center', color: '#111827' }}>{item.quantity} Pcs</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: '#111827' }}>{fmt(item.unit_price || 0)}</td>
                      <td style={{ padding: '4px', textAlign: 'center', color: '#111827' }}>{disc > 0 ? `${disc}%` : '–'}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{fmt(amount)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '12px', color: GRAY }}>No items added</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ border: `0.5px solid ${BORDER}`, marginTop: '0' }}>
              {/* Subtotal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: '8px', color: '#374151' }}>Subtotal:</span>
                <span style={{ width: '90px', textAlign: 'right', fontSize: '8px', color: '#111827' }}>{fmt(subtotal)}</span>
              </div>

              {/* GST rows */}
              {supplyType === 'IGST' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                  <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: '8px', color: '#374151' }}>IGST ({displayRate}% on Subtotal):</span>
                  <span style={{ width: '90px', textAlign: 'right', fontSize: '8px', color: '#111827' }}>{fmt(totalGst)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                    <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: '8px', color: '#374151' }}>CGST ({halfRate}%):</span>
                    <span style={{ width: '90px', textAlign: 'right', fontSize: '8px', color: '#111827' }}>{fmt(totalGst / 2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                    <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: '8px', color: '#374151' }}>SGST ({halfRate}%):</span>
                    <span style={{ width: '90px', textAlign: 'right', fontSize: '8px', color: '#111827' }}>{fmt(totalGst / 2)}</span>
                  </div>
                </>
              )}

              {/* Total with Tax */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                <span style={{ width: '180px', textAlign: 'right', paddingRight: '10px', fontSize: '9px', fontWeight: 'bold', color: NAVY }}>Total Amount (with Tax):</span>
                <span style={{ width: '90px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: NAVY }}>{fmt(total)}</span>
              </div>

              {/* IGST OUTPUT */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `0.5px solid ${BORDER}`, padding: '4px 6px' }}>
                <span style={{ flex: 1, textAlign: 'right', paddingRight: '10px', fontSize: '9px', fontWeight: 'bold', color: NAVY }}>IGST OUTPUT</span>
              </div>

              {/* Words */}
              <div style={{ padding: '6px 8px' }}>
                <span style={{ fontSize: '8px', color: '#111827' }}>
                  <strong>Total Amount in Words: </strong>
                  {convertToIndianWords(total)}
                </span>
              </div>
            </div>

            {/* Bottom: bank + signature */}
            <div style={{ display: 'flex', flexDirection: 'row', marginTop: '14px' }}>
              {/* Left: bank details */}
              <div style={{ width: '55%', paddingRight: '12px' }}>
                {formData.notes && (
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 'bold', color: NAVY, marginBottom: '4px' }}>Notes:</p>
                    <p style={{ fontSize: '8px', color: '#374151' }}>{formData.notes}</p>
                  </div>
                )}
                {(profile?.bank_name || profile?.bank_account_number || profile?.bank_ifsc) && (
                  <div>
                    <p style={{ fontSize: '8px', fontWeight: 'bold', color: NAVY, marginBottom: '4px' }}>Bank Details:</p>
                    {profile?.bank_name && <p style={{ fontSize: '8px', color: '#374151', marginBottom: '2px' }}>Bank Name: {profile.bank_name}</p>}
                    {profile?.bank_account_number && <p style={{ fontSize: '8px', color: '#374151', marginBottom: '2px' }}>Account No: {profile.bank_account_number}</p>}
                    {profile?.bank_ifsc && <p style={{ fontSize: '8px', color: '#374151', marginBottom: '2px' }}>IFSC: {profile.bank_ifsc}</p>}
                    {profile?.bank_branch && <p style={{ fontSize: '8px', color: '#374151' }}>Branch: {profile.bank_branch}</p>}
                  </div>
                )}
              </div>

              {/* Right: signature */}
              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <p style={{ fontSize: '8px', color: NAVY, marginBottom: '6px' }}>For {biz}</p>
                {(signatureBase64 || profile?.signature_url) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={signatureBase64 || profile?.signature_url || undefined} alt="Signature" style={{ width: '120px', height: '50px', objectFit: 'contain', marginBottom: '2px' }} />
                )}
                <div style={{ borderBottom: `0.5px solid #000`, width: '140px', marginBottom: '4px', marginTop: '4px' }} />
                <p style={{ fontSize: '8px', color: GRAY }}>Authorized Signatory</p>
                {profile?.signatory_name && <p style={{ fontSize: '8px', fontWeight: 'bold', color: NAVY }}>{profile.signatory_name}</p>}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div style={{ marginTop: '20px', border: `0.5px solid ${BORDER}`, backgroundColor: '#F8FAFC', padding: '8px' }}>
              <p style={{ fontSize: '8px', fontWeight: 'bold', color: NAVY, marginBottom: '4px' }}>Terms & Conditions</p>
              <p style={{ fontSize: '7.5px', color: '#475569', lineHeight: '1.6' }}>1. Goods once sold will not be taken back or exchanged under any circumstances unless prior written approval has been obtained.</p>
              <p style={{ fontSize: '7.5px', color: '#475569', lineHeight: '1.6' }}>2. Payment is due within the period mentioned above; a late payment fee of 2% per month will be charged on overdue amounts.</p>
              <p style={{ fontSize: '7.5px', color: '#475569', lineHeight: '1.6' }}>3. All disputes are subject to local jurisdiction only and shall be resolved as per the applicable laws of the land.</p>
              <p style={{ fontSize: '7.5px', color: '#475569', lineHeight: '1.6' }}>4. The seller shall not be liable for any delay in delivery due to circumstances beyond reasonable control, including acts of nature.</p>
              <p style={{ fontSize: '7.5px', color: '#475569', lineHeight: '1.6' }}>5. This invoice is computer generated and is valid without a physical signature unless otherwise specified by the issuing authority.</p>
            </div>

            {/* GSTIN at bottom */}
            {profile?.gstin && (
              <p style={{ fontSize: '8px', fontWeight: 'bold', textAlign: 'center', color: NAVY, marginTop: '10px' }}>
                GSTIN: {profile.gstin}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
