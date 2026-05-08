'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { convertToIndianWords, formatIndianCurrency, formatGstDate } from '@/lib/utils';
import type { SupplyType } from '@/types';

interface PdfLineItem {
  serial: number;
  description: string;
  hsn_sac?: string;
  gst_rate?: number;
  quantity: number;
  unit_price: number;
  amount: number;
  discount_percent?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#0E7490';
const NAVY = '#1E293B';
const BORDER = '#CBD5E1';
const GRAY = '#64748B';

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Page container
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 25,
    paddingRight: 25,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  outerBorder: {
    border: '1pt solid #CBD5E1',
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  },
  headerSection: {
    flexShrink: 0,
    flexGrow: 0,
  },
  itemsSection: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  footerSection: {
    flexShrink: 0,
    flexGrow: 0,
    borderTop: '0.5pt solid #CBD5E1',
  },
  // Top accent
  topBorder: { height: 3, backgroundColor: TEAL },
  // Compact Header
  compactHeaderRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER, alignItems: 'center' },
  compactHeaderLeft: { width: '60%', flexDirection: 'row', alignItems: 'center' },
  compactLogo: { width: 40, height: 40, objectFit: 'contain', marginRight: 8 },
  compactBizInfo: { flexDirection: 'column' },
  compactBizName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY },
  compactBizAddress: { fontSize: 7, color: GRAY },
  compactHeaderRight: { width: '40%', alignItems: 'flex-end', justifyContent: 'center' },
  compactInvoiceTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  compactInvoiceMeta: { fontSize: 8, color: '#374151' },
  // Header
  headerRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },
  headerLeft: { width: '60%' },
  headerRight: { width: '40%', alignItems: 'flex-end' },
  logo: { width: 70, height: 70, objectFit: 'contain', marginBottom: 6 },
  bizName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 3 },
  bizDetail: { fontSize: 8, color: GRAY, marginBottom: 1 },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6 },
  invoiceMeta: { fontSize: 8, color: '#374151', marginBottom: 3 },
  // Bill To
  billSection: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  billLeft: { width: '60%' },
  billRight: { width: '40%', alignItems: 'flex-end' },
  billToLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  billName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 },
  billDetail: { fontSize: 8, color: '#374151', marginBottom: 1 },
  // Table
  tableHeaderRow: { flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 4 },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  dataRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, borderLeftWidth: 0.5, borderLeftColor: BORDER, borderRightWidth: 0.5, borderRightColor: BORDER, paddingVertical: 5, paddingHorizontal: 4 },
  td: { fontSize: 8, color: '#111827' },
  // Column widths
  colSI: { width: 22, textAlign: 'center' },
  colDesc: { width: 140 },
  colHSN: { width: 58, textAlign: 'center' },
  colGST: { width: 34, textAlign: 'center' },
  colQty: { width: 42, textAlign: 'center' },
  colRate: { width: 63, textAlign: 'right' },
  colDisc: { width: 34, textAlign: 'center' },
  colAmt: { width: 68, textAlign: 'right' },
  // Totals
  totalsSection: { borderWidth: 0.5, borderColor: BORDER },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 4, paddingRight: 6 },
  totalLabel: { fontSize: 8, color: '#374151', width: 180, textAlign: 'right', paddingRight: 10 },
  totalValue: { fontSize: 8, color: '#111827', width: 90, textAlign: 'right' },
  totalLabelBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, width: 180, textAlign: 'right', paddingRight: 10 },
  totalValueBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, width: 90, textAlign: 'right' },
  igstOutputRow: { flexDirection: 'row', justifyContent: 'flex-end', borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 4, paddingRight: 6 },
  igstOutputLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, textAlign: 'right', flex: 1, paddingRight: 10 },
  wordsRow: { paddingVertical: 6, paddingHorizontal: 8 },
  wordsText: { fontSize: 8, color: '#111827', lineHeight: 1.5 },
  // Bottom
  bottomSection: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10 },
  bottomLeft: { width: '55%', paddingRight: 12 },
  bottomRight: { width: '45%', alignItems: 'flex-end' },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4 },
  bankDetail: { fontSize: 8, color: '#374151', marginBottom: 2 },
  signLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', width: 140, marginVertical: 4 },
  signLabel: { fontSize: 8, color: GRAY },
  signName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY },
  forCompany: { fontSize: 8, color: NAVY, marginBottom: 6 },
  // Footer
  pageFooter: { borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, paddingHorizontal: 8, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY },
  gstinBottom: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: NAVY, paddingVertical: 6 },
  // Terms & Conditions
  termsContainer: {
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: '#F8FAFC',
    padding: 8,
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 4,
  },
  termsText: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.6,
  },
  // Subtotal row for non-last pages (inside footer section)
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingRight: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
});

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  hsn_sac: string;
  gst_rate: number;
  discount_percent: number;
}

interface SerializedItem extends InvoicePdfItem {
  serial: number;
}

export interface InvoicePdfData {
  invoice_number: string;
  bill_number?: string;
  issue_date: string;
  order_id?: string;
  order_date?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  supply_type?: SupplyType;
  place_of_supply?: string;
  items: InvoicePdfItem[];
  business_name?: string;
  business_email?: string;
  business_address?: string;
  business_phone?: string;
  gstin?: string;
  website?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  client_gstin?: string;
  client_state?: string;
  client_state_code?: string;
  logoBase64?: string | null;
  signatureBase64?: string | null;
  signatoryName?: string | null;
}

// ─── Dynamic Splitting ────────────────────────────────────────────────────────
//
// All heights measured from actual @react-pdf Helvetica rendering metrics:
//   lineHeight ≈ fontSize × 1.171 (Helvetica ascender/descender ratio)
//   8pt text ≈ 9.4pt line height, 7pt ≈ 8.2pt, 13pt ≈ 15.2pt, 22pt ≈ 25.8pt
//
// A4 height = 841.89pt
// Page padding top(20) + bottom(20) = 40pt
// Outer border stroke = ~2pt (1pt each side)
const A4_USABLE = 841.89 - 40 - 2; // ≈ 799.89pt

// ── Section heights ──────────────────────────────────────────────────────────
// Full header (page 1): topBorder(3) + headerRow padding(16) + left col content
//   logo(70)+mb(6) + bizName(15.2)+mb(3) + ~5 bizDetail lines(5×10.4) = 146.2
//   Total: 3 + 16 + 146.2 ≈ 165
const FULL_HEADER_HEIGHT = 165;

// Client info: billToLabel(8.2+mb4) + billName(11.7+mb2) + ~4 detail lines(4×10.4)
//   + paddingBottom(8) + borderBottom(1) ≈ 67.5
const CLIENT_INFO_HEIGHT = 68;

// Table column header: paddingVertical(10) + fontSize 7pt text(8.2) ≈ 18.2
const TABLE_COL_HEADER_HEIGHT = 18;

// Compact header (page 2+): topBorder(3) + padding(12) + logo(40) + border(0.5) ≈ 55.5
const COMPACT_HEADER_HEIGHT = 56;

// B/F row: paddingVertical(10) + fontSize 8pt text(9.4) + border(0.5) ≈ 19.9
const BF_ROW_HEIGHT = 20;

// Subtotal row: paddingVertical(8) + text(9.4) + border(0.5) ≈ 17.9
const SUBTOTAL_ROW_HEIGHT = 18;

// Bank + signatory section:
//   paddingTop(10) + right col (taller with signature):
//   forCompany(9.4+mb6) + sigImage(50+mb2) + signLine(8.5) + signLabel(9.4) + signName(9.4) ≈ 94.7
//   Total: 10 + 94.7 ≈ 104.7
const BANK_SIGNATORY_HEIGHT = 105;

// Page footer: borderTop(0.5) + paddingTop(5) + text(8.2) + paddingBottom(4) ≈ 17.7
const PAGE_FOOTER_HEIGHT = 18;

// Last-page-only extras
const IGST_ROW_HEIGHT = 18;            // paddingVertical(8) + text(9.4) + border(0.5)
const TOTAL_WITH_TAX_ROW_HEIGHT = 19;  // paddingVertical(8) + bold 9pt text(10.5) + border(0.5)
const IGST_OUTPUT_ROW_HEIGHT = 18;     // same as IGST row
const AMOUNT_IN_WORDS_HEIGHT = 24;     // paddingVertical(12) + text(9.4×1.5 lineHeight) ≈ 12+14
const GSTIN_LINE_HEIGHT = 21;          // paddingVertical(12) + bold text(9.4)
const TERMS_HEIGHT = 105;              // margins(14) + padding(16) + title(13.4) + 5 terms lines(5×12)

// ── Pre-computed available heights ───────────────────────────────────────────
const NON_LAST_FOOTER_HEIGHT = SUBTOTAL_ROW_HEIGHT + BANK_SIGNATORY_HEIGHT + PAGE_FOOTER_HEIGHT;
// = 18 + 105 + 18 = 141

const LAST_FOOTER_HEIGHT =
  SUBTOTAL_ROW_HEIGHT +
  IGST_ROW_HEIGHT +
  TOTAL_WITH_TAX_ROW_HEIGHT +
  IGST_OUTPUT_ROW_HEIGHT +
  AMOUNT_IN_WORDS_HEIGHT +
  BANK_SIGNATORY_HEIGHT +
  GSTIN_LINE_HEIGHT +
  TERMS_HEIGHT +
  PAGE_FOOTER_HEIGHT;
// = 18+18+19+18+24+105+21+105+18 = 346

const PAGE1_ITEMS_AVAIL = A4_USABLE - FULL_HEADER_HEIGHT - CLIENT_INFO_HEIGHT - TABLE_COL_HEADER_HEIGHT - NON_LAST_FOOTER_HEIGHT;
// ≈ 799.89 - 165 - 68 - 18 - 141 = ~407.89

const MIDDLE_ITEMS_AVAIL = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - NON_LAST_FOOTER_HEIGHT;
// ≈ 799.89 - 56 - 18 - 20 - 141 = ~564.89

const LAST_ITEMS_AVAIL = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - LAST_FOOTER_HEIGHT;
// ≈ 799.89 - 56 - 18 - 20 - 346 = ~359.89

const SINGLE_PAGE_ITEMS_AVAIL = A4_USABLE - FULL_HEADER_HEIGHT - CLIENT_INFO_HEIGHT - TABLE_COL_HEADER_HEIGHT - LAST_FOOTER_HEIGHT;
// ≈ 799.89 - 165 - 68 - 18 - 346 = ~202.89

// ── Item height estimation ───────────────────────────────────────────────────
// At 8pt Helvetica: lineHeight ≈ 9.4pt per text line
// dataRow: paddingVertical(5+5=10pt) + borderBottom(0.5pt) + text lines
// Description column width = 140pt → ~35 chars/line at ~4pt avg char width
function estimateItemHeight(item: InvoicePdfItem | SerializedItem): number {
  const desc = item.description || '';
  if (desc.length > 70) return 38;  // 3+ lines: 10.5 + 3×9.4 ≈ 38.7
  if (desc.length > 35) return 28;  // 2 lines:  10.5 + 2×9.4 ≈ 29.3
  return 20;                         // 1 line:   10.5 + 9.4   ≈ 19.9
}

function takeItemsThatFit<T extends InvoicePdfItem>(
  items: T[],
  availHeight: number,
): T[] {
  let usedHeight = 0;
  let count = 0;
  for (const item of items) {
    const h = estimateItemHeight(item);
    if (usedHeight + h > availHeight && count > 0) break;
    usedHeight += h;
    count++;
  }
  return items.slice(0, count);
}

function willFitOnLastPage<T extends InvoicePdfItem>(
  items: T[],
  lastAvailHeight: number,
): boolean {
  const totalHeight = items.reduce(
    (sum, item) => sum + estimateItemHeight(item), 0
  );
  return totalHeight <= lastAvailHeight;
}

function splitItemsDynamically(items: SerializedItem[]): SerializedItem[][] {
  if (items.length === 0) return [[]];

  // Check if all fit on a single page
  if (willFitOnLastPage(items, SINGLE_PAGE_ITEMS_AVAIL)) {
    return [items];
  }

  const chunks: SerializedItem[][] = [];
  let remaining = [...items];

  // Page 1
  const page1Items = takeItemsThatFit(remaining, PAGE1_ITEMS_AVAIL);
  chunks.push(page1Items);
  remaining = remaining.slice(page1Items.length);

  if (remaining.length === 0) {
    // Everything fit on page 1 (shouldn't happen given single-page check, but safety)
    return [items];
  }

  // Middle + last pages
  while (remaining.length > 0) {
    // Check if remaining items fit on a last page
    if (willFitOnLastPage(remaining, LAST_ITEMS_AVAIL)) {
      chunks.push(remaining);
      break;
    }

    // Take items for a middle page
    const pageItems = takeItemsThatFit(remaining, MIDDLE_ITEMS_AVAIL);

    if (pageItems.length === 0) {
      // Safety: force at least 1 item to prevent infinite loop
      chunks.push([remaining[0]]);
      remaining = remaining.slice(1);
    } else {
      chunks.push(pageItems);
      remaining = remaining.slice(pageItems.length);
    }
  }

  return chunks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableColumnHeaderRow() {
  return (
    <View style={s.tableHeaderRow}>
      <Text style={[s.th, s.colSI]}>SI No</Text>
      <Text style={[s.th, s.colDesc]}>Description</Text>
      <Text style={[s.th, s.colHSN]}>HSN</Text>
      <Text style={[s.th, s.colGST]}>GST</Text>
      <Text style={[s.th, s.colQty]}>Qty</Text>
      <Text style={[s.th, s.colRate]}>Rate</Text>
      <Text style={[s.th, s.colDisc]}>Disc</Text>
      <Text style={[s.th, s.colAmt]}>Amount</Text>
    </View>
  );
}

function BFRow({ amount }: { amount: number }) {
  return (
    <View style={[s.dataRow, { justifyContent: 'flex-end', paddingRight: 4, borderTopWidth: 0, backgroundColor: '#D1D5DB' }]} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', color: '#111827', paddingRight: 10 }}>B/F</Text>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', color: '#111827', width: 68, textAlign: 'right' }}>
        {formatIndianCurrency(amount)}
      </Text>
    </View>
  );
}

function ItemRow({ item }: { item: PdfLineItem }) {
  const disc = item.discount_percent ?? 0;
  return (
    <View style={s.dataRow} wrap={false}>
      <Text style={[s.td, s.colSI]}>{String(item.serial)}</Text>
      <Text style={[s.td, s.colDesc]}>{item.description}</Text>
      <Text style={[s.td, s.colHSN]}>{item.hsn_sac || ''}</Text>
      <Text style={[s.td, s.colGST]}>{item.gst_rate ? `${item.gst_rate}%` : ''}</Text>
      <Text style={[s.td, s.colQty]}>{`${item.quantity}`}</Text>
      <Text style={[s.td, s.colRate]}>{formatIndianCurrency(item.unit_price)}</Text>
      <Text style={[s.td, s.colDisc]}>{disc > 0 ? `${disc}%` : '–'}</Text>
      <Text style={[s.td, s.colAmt]}>{formatIndianCurrency(item.amount)}</Text>
    </View>
  );
}

function FullHeader({ data, biz }: { data: InvoicePdfData; biz: string }) {
  return (
    <>
      <View style={s.topBorder} />
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          {data.logoBase64 && (
            /* eslint-disable-next-line jsx-a11y/alt-text */
            <Image src={data.logoBase64} style={s.logo} />
          )}
          <Text style={s.bizName}>{biz}</Text>
          {data.business_address && <Text style={s.bizDetail}>Add: {data.business_address}</Text>}
          {data.business_phone && <Text style={s.bizDetail}>Phone: {data.business_phone}</Text>}
          {data.business_email && <Text style={s.bizDetail}>{data.business_email}</Text>}
          {data.website && <Text style={s.bizDetail}>{data.website}</Text>}
          {data.gstin && <Text style={s.bizDetail}>GSTIN: {data.gstin}</Text>}
        </View>
        <View style={s.headerRight}>
          <Text style={s.invoiceTitle}>Invoice</Text>
          <Text style={s.invoiceMeta}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Bill No.: </Text>
            {data.bill_number || data.invoice_number}
          </Text>
          <Text style={s.invoiceMeta}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Date: </Text>
            {formatGstDate(data.issue_date)}
          </Text>
          {data.order_id && (
            <Text style={s.invoiceMeta}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Order ID: </Text>
              {data.order_id}
            </Text>
          )}
          {data.order_date && (
            <Text style={s.invoiceMeta}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Order Date: </Text>
              {formatGstDate(data.order_date)}
            </Text>
          )}
        </View>
      </View>
    </>
  );
}

function ClientInfoSection({ data }: { data: InvoicePdfData }) {
  return (
    <View style={s.billSection}>
      <View style={s.billLeft}>
        <Text style={s.billToLabel}>To,</Text>
        <Text style={s.billName}>{data.client_name || 'N/A'}</Text>
        {data.client_company && <Text style={s.billDetail}>{data.client_company}</Text>}
        {data.client_gstin && <Text style={s.billDetail}>{data.client_gstin}</Text>}
        {data.client_address && <Text style={s.billDetail}>{data.client_address}</Text>}
        {data.client_state && (
          <Text style={s.billDetail}>
            State: {data.client_state}{data.client_state_code ? ` (${data.client_state_code})` : ''}
          </Text>
        )}
      </View>
      {data.place_of_supply && (
        <View style={s.billRight}>
          <Text style={s.billDetail}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Place of Supply: </Text>
            {data.place_of_supply}
          </Text>
        </View>
      )}
    </View>
  );
}

function CompactHeader({ data, biz }: { data: InvoicePdfData; biz: string }) {
  return (
    <>
      <View style={s.topBorder} />
      <View style={s.compactHeaderRow}>
        <View style={s.compactHeaderLeft}>
          {data.logoBase64 && (
            /* eslint-disable-next-line jsx-a11y/alt-text */
            <Image src={data.logoBase64} style={s.compactLogo} />
          )}
          <View style={s.compactBizInfo}>
            <Text style={s.compactBizName}>{biz}</Text>
            {data.business_address && <Text style={s.compactBizAddress}>{data.business_address}</Text>}
          </View>
        </View>
        <View style={s.compactHeaderRight}>
          <Text style={s.compactInvoiceTitle}>Invoice</Text>
          <Text style={s.compactInvoiceMeta}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Bill No.: </Text>
            {data.bill_number || data.invoice_number}
          </Text>
          <Text style={s.compactInvoiceMeta}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Date: </Text>
            {formatGstDate(data.issue_date)}
          </Text>
        </View>
      </View>
    </>
  );
}

function SubtotalRow({ amount }: { amount: number }) {
  return (
    <View style={s.subtotalRow}>
      <Text style={s.totalLabel}>Subtotal:</Text>
      <Text style={s.totalValue}>{formatIndianCurrency(amount)}</Text>
    </View>
  );
}

function IGSTRow({ data, subtotal }: { data: InvoicePdfData; subtotal: number }) {
  const supplyType = data.supply_type || 'IGST';
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const halfRate = commonRate / 2;

  if (supplyType === 'IGST') {
    return (
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>{`IGST (${commonRate}%):`}</Text>
        <Text style={s.totalValue}>{formatIndianCurrency(totalGstAmount)}</Text>
      </View>
    );
  }
  return (
    <>
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>{`CGST (${halfRate}%):`}</Text>
        <Text style={s.totalValue}>{formatIndianCurrency(totalGstAmount / 2)}</Text>
      </View>
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>{`SGST (${halfRate}%):`}</Text>
        <Text style={s.totalValue}>{formatIndianCurrency(totalGstAmount / 2)}</Text>
      </View>
    </>
  );
}

function TotalWithTaxRow({ subtotal, data }: { subtotal: number; data: InvoicePdfData }) {
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const total = subtotal + totalGstAmount;
  return (
    <View style={s.totalRow}>
      <Text style={s.totalLabelBold}>Total Amount (with Tax):</Text>
      <Text style={s.totalValueBold}>{formatIndianCurrency(total)}</Text>
    </View>
  );
}

function IGSTOutputRow() {
  return (
    <View style={s.igstOutputRow}>
      <Text style={s.igstOutputLabel}>IGST OUTPUT</Text>
    </View>
  );
}

function AmountInWordsRow({ subtotal, data }: { subtotal: number; data: InvoicePdfData }) {
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const total = subtotal + totalGstAmount;
  return (
    <View style={s.wordsRow}>
      <Text style={s.wordsText}>
        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Total Amount in Words: </Text>
        {convertToIndianWords(total)}
      </Text>
    </View>
  );
}

function BankAndSignatorySection({ data }: { data: InvoicePdfData }) {
  const hasBankDetails = data.bank_name || data.bank_account_number || data.bank_ifsc;
  return (
    <View style={s.bottomSection}>
      {/* Left: notes + bank */}
      <View style={s.bottomLeft}>
        {data.notes && (
          <View style={{ marginBottom: 8 }}>
            <Text style={s.sectionLabel}>Notes:</Text>
            <Text style={{ fontSize: 8, color: '#374151', lineHeight: 1.5 }}>{data.notes}</Text>
          </View>
        )}
        {hasBankDetails && (
          <View>
            <Text style={s.sectionLabel}>Bank Details:</Text>
            {data.bank_name && <Text style={s.bankDetail}>Bank Name: {data.bank_name}</Text>}
            {data.bank_account_number && <Text style={s.bankDetail}>Account No: {data.bank_account_number}</Text>}
            {data.bank_ifsc && <Text style={s.bankDetail}>IFSC: {data.bank_ifsc}</Text>}
            {data.bank_branch && <Text style={s.bankDetail}>Branch: {data.bank_branch}</Text>}
          </View>
        )}
      </View>

      {/* Right: signature */}
      <View style={s.bottomRight}>
        <Text style={s.forCompany}>For {data.business_name || 'Company'}</Text>
        {data.signatureBase64 && (
          /* eslint-disable-next-line jsx-a11y/alt-text */
          <Image src={data.signatureBase64} style={{ width: 120, height: 50, objectFit: 'contain', marginBottom: 2 }} />
        )}
        <View style={s.signLine} />
        <Text style={s.signLabel}>Authorized Signatory</Text>
        {data.signatoryName && <Text style={s.signName}>{data.signatoryName}</Text>}
      </View>
    </View>
  );
}

function GSTINLine({ gstin }: { gstin?: string }) {
  if (!gstin) return null;
  return <Text style={s.gstinBottom}>GSTIN: {gstin}</Text>;
}

function TermsAndConditions() {
  return (
    <View style={s.termsContainer}>
      <Text style={s.termsTitle}>Terms & Conditions</Text>
      <Text style={s.termsText}>
        1. Goods once sold will not be taken back or exchanged under any circumstances unless prior written approval has been obtained.
      </Text>
      <Text style={s.termsText}>
        2. Payment is due within the period mentioned above; a late payment fee of 2% per month will be charged on overdue amounts.
      </Text>
      <Text style={s.termsText}>
        3. All disputes are subject to local jurisdiction only and shall be resolved as per the applicable laws of the land.
      </Text>
      <Text style={s.termsText}>
        4. The seller shall not be liable for any delay in delivery due to circumstances beyond reasonable control, including acts of nature.
      </Text>
      <Text style={s.termsText}>
        5. This invoice is computer generated and is valid without a physical signature unless otherwise specified by the issuing authority.
      </Text>
    </View>
  );
}

function PageFooter({ current, total, biz }: { current: number; total: number; biz: string }) {
  return (
    <View style={s.pageFooter}>
      <Text style={s.footerText}>{biz}</Text>
      <Text style={s.footerText}>
        Page {current} of {total}
      </Text>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const itemsWithSerial = data.items.map((item, index) => ({
    ...item,
    serial: index + 1,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    amount: Number(item.amount) || 0,
  }));

  const chunks = splitItemsDynamically(itemsWithSerial);
  const biz = data.business_name || 'QuickInvoice';
  const totalPages = chunks.length;
  const isSinglePage = totalPages === 1;

  // Calculate running subtotals
  let runningTotal = 0;
  const pageSubtotals: number[] = chunks.map(chunk => {
    runningTotal += chunk.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    return runningTotal;
  });

  return (
    <Document>
      {chunks.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === chunks.length - 1;
        const pageNumber = pageIndex + 1;
        const bfAmount = pageIndex > 0 ? pageSubtotals[pageIndex - 1] : 0;
        const cumulativeSubtotal = pageSubtotals[pageIndex];

        return (
          <Page key={pageIndex} size="A4" style={s.page} wrap={false}>
            <View style={s.outerBorder}>

              {/* ─── HEADER — pinned to top, never shrinks ─── */}
              <View style={s.headerSection}>
                {isFirstPage
                  ? <FullHeader data={data} biz={biz} />
                  : <CompactHeader data={data} biz={biz} />
                }
                {isFirstPage && <ClientInfoSection data={data} />}
                <TableColumnHeaderRow />
                {!isFirstPage && <BFRow amount={bfAmount} />}
              </View>

              {/* ─── ITEMS — fills space between header and footer ─── */}
              <View style={s.itemsSection}>
                {pageItems.map((item) => (
                  <ItemRow key={(item as SerializedItem).serial} item={item} />
                ))}
              </View>

              {/* ─── FOOTER — pinned to bottom, never shrinks ─── */}
              <View style={s.footerSection}>
                <SubtotalRow amount={cumulativeSubtotal} />
                {(isLastPage || isSinglePage) && <IGSTRow data={data} subtotal={cumulativeSubtotal} />}
                {(isLastPage || isSinglePage) && <TotalWithTaxRow subtotal={cumulativeSubtotal} data={data} />}
                {(isLastPage || isSinglePage) && <IGSTOutputRow />}
                {(isLastPage || isSinglePage) && <AmountInWordsRow subtotal={cumulativeSubtotal} data={data} />}
                <BankAndSignatorySection data={data} />
                {(isLastPage || isSinglePage) && <GSTINLine gstin={data.gstin} />}
                {(isLastPage || isSinglePage) && <TermsAndConditions />}
                <PageFooter current={pageNumber} total={totalPages} biz={biz} />
              </View>

            </View>
          </Page>
        );
      })}
    </Document>
  );
}
