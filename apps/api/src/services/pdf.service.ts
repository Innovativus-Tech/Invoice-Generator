import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { storageService } from './storage.service.js';
import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';

// ─── Utility Functions ──────────────────────────────────────────────────────

export async function getImageAsBase64(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;
  try {
    const bucketId = process.env.STORAGE_BUCKET || 'invoices';
    let path = '';

    if (imageUrl.includes(`/storage/v1/object/public/${bucketId}/`)) {
      path = imageUrl.split(`/storage/v1/object/public/${bucketId}/`)[1];
    } else if (imageUrl.includes(`/storage/v1/object/sign/${bucketId}/`)) {
      path = imageUrl.split(`/storage/v1/object/sign/${bucketId}/`)[1].split('?')[0];
    } else {
      const searchStr = `${bucketId}/`;
      const idx = imageUrl.lastIndexOf(searchStr);
      if (idx !== -1) {
        path = imageUrl.substring(idx + searchStr.length).split('?')[0];
      } else {
        return null;
      }
    }

    if (!path) return null;

    const { data, error } = await supabase.storage.from(bucketId).download(path);
    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = data.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Format number in Indian lakh/crore style: 2,65,000.00 */
function formatIndianCurrency(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  let result = '';
  const n = intPart.length;
  if (n <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(n - 3);
    let remaining = intPart.slice(0, n - 3);
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    result = remaining + ',' + result;
  }
  return `Rs. ${amount < 0 ? '-' : ''}${result}.${decPart}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + numToWords(n % 100) : '');
}

function convertToIndianWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = '';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore > 0) words += numToWords(crore) + ' Crore ';
  if (lakh > 0) words += numToWords(lakh) + ' Lakh ';
  if (thousand > 0) words += numToWords(thousand) + ' Thousand ';
  if (rest > 0) words += numToWords(rest);
  let result = 'Rupees ' + words.trim();
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}

/** Format date as "06th April 2026" */
function formatGstDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
    : day === 3 || day === 23 ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-IN', { month: 'long' });
  return `${String(day).padStart(2, '0')}${suffix} ${month} ${d.getFullYear()}`;
}

// ─── Data Interfaces ─────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  hsn_sac: string;
  gst_rate: number;
  discount_percent: number;
  isbn?: string | null;
  author?: string | null;
  binding?: string | null;
  damaged_qty?: number | null;
}

interface SerializedItem extends InvoiceItem {
  serial: number;
}

type Opt<T> = T | null | undefined;

export interface InvoiceData {
  doc_type?: string;
  doc_title?: string;
  doc_label?: string;
  is_bill?: boolean;
  side?: 'sales' | 'purchase';
  invoice_number: string;
  bill_number?: Opt<string>;
  status: string;
  issue_date: string;
  due_date?: Opt<string>;
  payment_mode?: string;
  credit_days?: number;
  order_id?: Opt<string>;
  order_date?: Opt<string>;
  party_ref_number?: Opt<string>;
  party_ref_date?: Opt<string>;
  valid_until?: Opt<string>;
  reason?: Opt<string>;
  source_doc?: Opt<{ invoice_number: string; doc_type: string }>;
  subtotal: number;
  tax_rate?: number;
  tax_amount: number;
  discount_amount: number;
  extra_discount_type?: string;
  extra_discount_value?: number;
  postage_charge?: number;
  other_charges?: number;
  other_charges_label?: Opt<string>;
  round_off?: number;
  total: number;
  amount_paid?: number;
  balance_due?: number;
  currency: Opt<string>;
  notes?: Opt<string>;
  terms?: Opt<string>;
  supply_type?: Opt<string>;
  place_of_supply?: Opt<string>;
  items: InvoiceItem[];
  shipping_name?: Opt<string>;
  shipping_address?: Opt<string>;
  dispatch_mode?: string;
  delivery_status?: string;
  courier_name?: Opt<string>;
  tracking_number?: Opt<string>;
  dispatch_date?: Opt<string>;
  expected_delivery_date?: Opt<string>;
  transport_name?: Opt<string>;
  lr_number?: Opt<string>;
  vehicle_number?: Opt<string>;
  cartons?: Opt<number>;
  freight_type?: Opt<string>;
  delivery_type?: Opt<string>;
  transport_details?: Opt<string>;
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
  client_name?: Opt<string>;
  client_email?: Opt<string>;
  client_company?: Opt<string>;
  client_address?: Opt<string>;
  client_gstin?: Opt<string>;
  client_state?: Opt<string>;
  client_state_code?: Opt<string>;
  client_phone?: Opt<string>;
  logo_url?: string;
  signature_url?: string;
  signatory_name?: string;
  show_book_metadata?: boolean;
}

const NUMBER_LABEL: Record<string, string> = {
  sales_invoice: 'Bill No.',
  estimate: 'Estimate No.',
  delivery_challan: 'Challan No.',
  sales_return: 'Return No.',
  credit_note: 'Credit Note No.',
  purchase_bill: 'Bill No.',
  purchase_return: 'Return No.',
  debit_note: 'Debit Note No.',
  binding_order: 'Order No.',
};

const docType = (d: InvoiceData) => d.doc_type || 'sales_invoice';
const isSalesInvoice = (d: InvoiceData) => docType(d) === 'sales_invoice';

function partyLabel(d: InvoiceData) {
  if (docType(d) === 'binding_order') return 'Binder';
  return d.side === 'purchase' ? 'Supplier' : 'Bill To';
}

/** Short wording printed above the bank details: disclaimers and reasons. */
function docRemarks(d: InvoiceData): string | null {
  switch (docType(d)) {
    case 'estimate':
      return `This is an estimate (approximate bill), not a tax invoice. Prices are approximate and may change${d.valid_until ? `; valid until ${formatGstDate(d.valid_until)}` : ''}.`;
    case 'delivery_challan':
      return 'Goods sent under delivery challan. This is not a tax invoice.';
    case 'binding_order':
      return 'Please bind and deliver the above titles. Rates are per copy.';
    case 'sales_return':
    case 'purchase_return':
    case 'credit_note':
    case 'debit_note':
      return d.reason ? `Reason: ${d.reason}` : null;
    default:
      return null;
  }
}

function dispatchLines(d: InvoiceData): string[] {
  const parts = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join('  ·  ');
  if (d.dispatch_mode === 'courier') {
    return [parts(
      `Courier: ${d.courier_name || '—'}`,
      d.tracking_number && `Tracking / AWB: ${d.tracking_number}`,
      d.dispatch_date && `Dispatched: ${formatGstDate(d.dispatch_date)}`,
      d.expected_delivery_date && `Expected: ${formatGstDate(d.expected_delivery_date)}`
    )];
  }
  if (d.dispatch_mode === 'transport') {
    return [
      parts(
        `Transport: ${d.transport_name || '—'}`,
        d.lr_number && `LR / GR No.: ${d.lr_number}`,
        d.vehicle_number && `Vehicle: ${d.vehicle_number}`,
        d.dispatch_date && `Dispatched: ${formatGstDate(d.dispatch_date)}`
      ),
      parts(
        d.cartons != null && `Cartons: ${d.cartons}`,
        d.freight_type && `Freight: ${d.freight_type === 'paid' ? 'Paid' : 'To Pay (unpaid)'}`,
        d.delivery_type && (d.delivery_type === 'door' ? 'Door Delivery' : 'Godown Delivery'),
        d.transport_details
      ),
    ].filter(Boolean);
  }
  if (d.dispatch_mode === 'hand') return ['Delivered by hand'];
  return [];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const TEAL = '#0E7490';
const NAVY = '#1E293B';
const BORDER = '#CBD5E1';
const GRAY = '#64748B';

const styles = StyleSheet.create({
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
  invoiceMetaLabel: { fontFamily: 'Helvetica-Bold' },
  // Bill To
  billSection: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  billLeft: { width: '60%' },
  billRight: { width: '40%', alignItems: 'flex-end' },
  billToLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  billName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 },
  billDetail: { fontSize: 8, color: '#374151', marginBottom: 1 },
  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderLeftWidth: 0.5,
    borderLeftColor: BORDER,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingRight: 6,
  },
  totalLabel: { fontSize: 8, color: '#374151', width: 180, textAlign: 'right', paddingRight: 10 },
  totalValue: { fontSize: 8, color: '#111827', width: 90, textAlign: 'right' },
  totalLabelBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, width: 180, textAlign: 'right', paddingRight: 10 },
  totalValueBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, width: 90, textAlign: 'right' },
  igstOutputRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingRight: 6,
  },
  igstOutputLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, textAlign: 'right', flex: 1, paddingRight: 10 },
  wordsRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
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
  pageFooter: {
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
    paddingHorizontal: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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

// ─── Dynamic Splitting ────────────────────────────────────────────────────────
// Page heights are estimated up front so every page keeps its header and
// footer; estimates err on the generous side because overflow is clipped.

const A4_USABLE = 841.89 - 40 - 2;

const FULL_HEADER_HEIGHT = 165;
const TABLE_COL_HEADER_HEIGHT = 18;
const COMPACT_HEADER_HEIGHT = 56;
const BF_ROW_HEIGHT = 20;

const ROW_HEIGHT = 18;
const BANK_SIGNATORY_HEIGHT = 105;
const PAGE_FOOTER_HEIGHT = 18;
const AMOUNT_IN_WORDS_HEIGHT = 24;
const GSTIN_LINE_HEIGHT = 21;
const TERMS_HEIGHT = 105;
const TEXT_LINE_HEIGHT = 11;

const lineCount = (text: Opt<string>, perLine: number) =>
  text ? text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0) : 0;

function showShipTo(d: InvoiceData) {
  return !!d.shipping_address && d.shipping_address.trim() !== (d.client_address ?? '').trim();
}

function clientInfoHeight(d: InvoiceData) {
  const left = 1 + (d.client_company ? 1 : 0) + (d.client_gstin ? 1 : 0) + lineCount(d.client_address, 55)
    + (d.client_state ? 1 : 0) + (d.client_phone ? 1 : 0);
  const right = showShipTo(d)
    ? 1 + lineCount(d.shipping_address, 40) + (d.place_of_supply ? 1 : 0)
    : (d.place_of_supply ? 1 : 0);
  return 30 + Math.max(left, right) * TEXT_LINE_HEIGHT;
}

function gstRowCount(d: InvoiceData) {
  if (d.tax_amount <= 0 && !isSalesInvoice(d)) return 0;
  return (d.supply_type || 'IGST') === 'IGST' ? 1 : 2;
}

/** Number of label/value rows in the last page's totals block (excluding subtotal). */
function totalRowCount(d: InvoiceData) {
  let rows = gstRowCount(d) + 1; // + total
  if (d.discount_amount > 0) rows += 2; // extra discount + taxable value
  if ((d.postage_charge ?? 0) > 0) rows++;
  if ((d.other_charges ?? 0) > 0) rows++;
  if ((d.round_off ?? 0) !== 0) rows++;
  if (isSalesInvoice(d)) rows++; // "IGST OUTPUT" marker row
  if (d.is_bill && d.payment_mode === 'credit' && (d.amount_paid ?? 0) > 0) rows += 2;
  return rows;
}

function lastFooterHeight(d: InvoiceData) {
  const remarks = docRemarks(d);
  const dispatch = dispatchLines(d);
  return ROW_HEIGHT // subtotal
    + totalRowCount(d) * ROW_HEIGHT
    + AMOUNT_IN_WORDS_HEIGHT
    + (remarks ? 8 + lineCount(remarks, 110) * TEXT_LINE_HEIGHT : 0)
    + (dispatch.length ? 14 + dispatch.length * TEXT_LINE_HEIGHT : 0)
    + BANK_SIGNATORY_HEIGHT
    + (d.gstin ? GSTIN_LINE_HEIGHT : 0)
    + (isSalesInvoice(d) ? TERMS_HEIGHT : 0)
    + PAGE_FOOTER_HEIGHT;
}

const NON_LAST_FOOTER_HEIGHT = ROW_HEIGHT + BANK_SIGNATORY_HEIGHT + PAGE_FOOTER_HEIGHT;

function itemMetaLines(item: InvoiceItem, showBookMetadata?: boolean): string[] {
  const meta: string[] = [];
  if (showBookMetadata) {
    if (item.isbn) meta.push(`ISBN: ${item.isbn}`);
    if (item.author) meta.push(`Author: ${item.author}`);
  }
  if (item.binding) meta.push(`Binding: ${item.binding}`);
  if (item.damaged_qty && item.damaged_qty > 0) meta.push(`Damaged: ${item.damaged_qty}`);
  return meta;
}

function estimateItemHeight(item: InvoiceItem, showBookMetadata?: boolean): number {
  const desc = item.description || '';
  const base = desc.length > 70 ? 38 : desc.length > 35 ? 28 : 20;
  return base + itemMetaLines(item, showBookMetadata).length * 9;
}

function takeItemsThatFit<T extends InvoiceItem>(items: T[], availHeight: number, meta?: boolean): T[] {
  let usedHeight = 0;
  let count = 0;
  for (const item of items) {
    const h = estimateItemHeight(item, meta);
    if (usedHeight + h > availHeight && count > 0) break;
    usedHeight += h;
    count++;
  }
  return items.slice(0, count);
}

function fits<T extends InvoiceItem>(items: T[], availHeight: number, meta?: boolean): boolean {
  return items.reduce((sum, item) => sum + estimateItemHeight(item, meta), 0) <= availHeight;
}

function splitItemsDynamically(items: SerializedItem[], d: InvoiceData): SerializedItem[][] {
  if (items.length === 0) return [[]];
  const meta = d.show_book_metadata;
  const client = clientInfoHeight(d);
  const last = lastFooterHeight(d);
  const singlePage = A4_USABLE - FULL_HEADER_HEIGHT - client - TABLE_COL_HEADER_HEIGHT - last;
  const firstPage = A4_USABLE - FULL_HEADER_HEIGHT - client - TABLE_COL_HEADER_HEIGHT - NON_LAST_FOOTER_HEIGHT;
  const middlePage = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - NON_LAST_FOOTER_HEIGHT;
  const lastPage = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - last;

  if (fits(items, singlePage, meta)) return [items];

  const chunks: SerializedItem[][] = [];
  let remaining = [...items];
  const page1 = takeItemsThatFit(remaining, firstPage, meta);
  chunks.push(page1);
  remaining = remaining.slice(page1.length);

  while (remaining.length > 0) {
    if (fits(remaining, lastPage, meta)) {
      chunks.push(remaining);
      break;
    }
    const pageItems = takeItemsThatFit(remaining, middlePage, meta);
    chunks.push(pageItems.length ? pageItems : [remaining[0]]);
    remaining = remaining.slice(Math.max(pageItems.length, 1));
  }
  // The totals block always needs a page of its own space; if the last chunk was
  // taken as a middle page, add an empty closing page.
  if (!fits(chunks[chunks.length - 1], chunks.length === 1 ? singlePage : lastPage, meta)) chunks.push([]);
  return chunks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableColumnHeaderRow() {
  return React.createElement(View, { style: styles.tableHeaderRow },
    React.createElement(Text, { style: [styles.th, styles.colSI] }, 'SI No'),
    React.createElement(Text, { style: [styles.th, styles.colDesc] }, 'Description'),
    React.createElement(Text, { style: [styles.th, styles.colHSN] }, 'HSN'),
    React.createElement(Text, { style: [styles.th, styles.colGST] }, 'GST'),
    React.createElement(Text, { style: [styles.th, styles.colQty] }, 'Qty'),
    React.createElement(Text, { style: [styles.th, styles.colRate] }, 'Rate'),
    React.createElement(Text, { style: [styles.th, styles.colDisc] }, 'Disc'),
    React.createElement(Text, { style: [styles.th, styles.colAmt] }, 'Amount')
  );
}

function BFRow({ amount }: { amount: number }) {
  return React.createElement(View, {
    style: [styles.dataRow, { justifyContent: 'flex-end', paddingRight: 4, borderTopWidth: 0, backgroundColor: '#D1D5DB' }],
    wrap: false
  },
    React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', color: '#111827', paddingRight: 10 } }, 'B/F'),
    React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', color: '#111827', width: 68, textAlign: 'right' } },
      formatIndianCurrency(amount)
    )
  );
}

function ItemRow({ item, showBookMetadata }: { item: SerializedItem; showBookMetadata?: boolean }) {
  const disc = item.discount_percent ?? 0;
  const meta = itemMetaLines(item, showBookMetadata);
  const descNode = meta.length > 0
    ? React.createElement(View, { style: styles.colDesc },
        React.createElement(Text, { style: styles.td }, item.description),
        ...meta.map((line, i) =>
          React.createElement(Text, { key: i, style: { fontSize: 7, color: line.startsWith('Damaged') ? '#B91C1C' : GRAY, marginTop: 1 } }, line)
        )
      )
    : React.createElement(Text, { style: [styles.td, styles.colDesc] }, item.description);

  return React.createElement(View, { style: styles.dataRow, wrap: false },
    React.createElement(Text, { style: [styles.td, styles.colSI] }, String(item.serial)),
    descNode,
    React.createElement(Text, { style: [styles.td, styles.colHSN] }, item.hsn_sac || ''),
    React.createElement(Text, { style: [styles.td, styles.colGST] }, item.gst_rate == null ? '' : `${item.gst_rate}%`),
    React.createElement(Text, { style: [styles.td, styles.colQty] }, `${item.quantity}`),
    React.createElement(Text, { style: [styles.td, styles.colRate] }, formatIndianCurrency(item.unit_price)),
    React.createElement(Text, { style: [styles.td, styles.colDisc] }, disc > 0 ? `${disc}%` : '–'),
    React.createElement(Text, { style: [styles.td, styles.colAmt] }, formatIndianCurrency(item.amount))
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return React.createElement(Text, { style: styles.invoiceMeta },
    React.createElement(Text, { style: styles.invoiceMetaLabel }, `${label}: `),
    value
  );
}

function FullHeader({ data, biz }: { data: InvoiceData; biz: string }) {
  const type = docType(data);
  const numberLabel = NUMBER_LABEL[type] ?? 'No.';
  const shownNumber = type === 'sales_invoice' ? data.bill_number || data.invoice_number : data.invoice_number;
  const meta: [string, string][] = [[numberLabel, shownNumber], ['Date', formatGstDate(data.issue_date)]];
  if (data.is_bill) {
    meta.push(['Payment', data.payment_mode === 'cash' ? 'Cash' : `Credit${data.credit_days ? ` (${data.credit_days} days)` : ''}`]);
    if (data.payment_mode === 'credit' && data.due_date) meta.push(['Due Date', formatGstDate(data.due_date)]);
  }
  if (type === 'estimate' && data.valid_until) meta.push(['Valid Until', formatGstDate(data.valid_until)]);
  if (data.source_doc) meta.push([type === 'sales_invoice' || type === 'purchase_bill' ? 'Ref' : 'Against', data.source_doc.invoice_number]);
  if (data.party_ref_number) {
    meta.push([data.side === 'purchase' ? 'Supplier Bill No.' : 'Party Ref', data.party_ref_number]);
  }
  if (data.order_id) meta.push(['Order ID', data.order_id]);
  if (data.order_date) meta.push(['Order Date', formatGstDate(data.order_date)]);

  return React.createElement(React.Fragment, null,
    React.createElement(View, { style: styles.topBorder }),
    React.createElement(View, { style: styles.headerRow },
      React.createElement(View, { style: styles.headerLeft },
        data.logo_url
          ? React.createElement(Image as any, { src: data.logo_url, style: styles.logo })
          : null,
        React.createElement(Text, { style: styles.bizName }, biz),
        data.business_address
          ? React.createElement(Text, { style: styles.bizDetail }, `Add: ${data.business_address}`)
          : null,
        data.business_phone
          ? React.createElement(Text, { style: styles.bizDetail }, `Phone: ${data.business_phone}`)
          : null,
        data.business_email
          ? React.createElement(Text, { style: styles.bizDetail }, data.business_email)
          : null,
        data.website
          ? React.createElement(Text, { style: styles.bizDetail }, data.website)
          : null,
        data.gstin
          ? React.createElement(Text, { style: styles.bizDetail }, `GSTIN: ${data.gstin}`)
          : null
      ),
      React.createElement(View, { style: styles.headerRight },
        React.createElement(Text, { style: [styles.invoiceTitle, (data.doc_title ?? '').length > 14 ? { fontSize: 16 } : {}] }, data.doc_title || 'Invoice'),
        ...meta.map(([label, value]) => React.createElement(MetaLine, { key: label, label, value }))
      )
    )
  );
}

function ClientInfoSection({ data }: { data: InvoiceData }) {
  const name = data.client_name || (data.payment_mode === 'cash' ? 'Cash' : 'N/A');
  const shipTo = showShipTo(data);
  return React.createElement(View, { style: styles.billSection },
    React.createElement(View, { style: styles.billLeft },
      React.createElement(Text, { style: [styles.billToLabel, { marginBottom: 6 }] }, partyLabel(data)),
      React.createElement(Text, { style: styles.billName }, name),
      data.client_company
        ? React.createElement(Text, { style: styles.billDetail }, data.client_company)
        : null,
      data.client_gstin
        ? React.createElement(Text, { style: styles.billDetail }, `GSTIN: ${data.client_gstin}`)
        : null,
      data.client_address
        ? React.createElement(Text, { style: styles.billDetail }, data.client_address)
        : null,
      data.client_state
        ? React.createElement(Text, { style: styles.billDetail },
            `State: ${data.client_state}${data.client_state_code ? ` (${data.client_state_code})` : ''}`
          )
        : null,
      data.client_phone
        ? React.createElement(Text, { style: styles.billDetail }, `Phone: ${data.client_phone}`)
        : null
    ),
    React.createElement(View, { style: [styles.billRight, shipTo ? { alignItems: 'flex-start' } : {}] },
      shipTo
        ? React.createElement(View, null,
            React.createElement(Text, { style: [styles.billToLabel, { marginBottom: 6 }] }, 'Ship To'),
            React.createElement(Text, { style: styles.billName }, data.shipping_name || name),
            React.createElement(Text, { style: styles.billDetail }, data.shipping_address)
          )
        : null,
      data.place_of_supply
        ? React.createElement(Text, { style: [styles.billDetail, shipTo ? { marginTop: 4 } : {}] },
            React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Place of Supply: '),
            data.place_of_supply
          )
        : null
    )
  );
}

function CompactHeader({ data, biz }: { data: InvoiceData; biz: string }) {
  const type = docType(data);
  return React.createElement(React.Fragment, null,
    React.createElement(View, { style: styles.topBorder }),
    React.createElement(View, { style: styles.compactHeaderRow },
      React.createElement(View, { style: styles.compactHeaderLeft },
        data.logo_url
          ? React.createElement(Image as any, { src: data.logo_url, style: styles.compactLogo })
          : null,
        React.createElement(View, { style: styles.compactBizInfo },
          React.createElement(Text, { style: styles.compactBizName }, biz),
          data.business_address
            ? React.createElement(Text, { style: styles.compactBizAddress }, data.business_address)
            : null
        )
      ),
      React.createElement(View, { style: styles.compactHeaderRight },
        React.createElement(Text, { style: styles.compactInvoiceTitle }, data.doc_title || 'Invoice'),
        React.createElement(Text, { style: styles.compactInvoiceMeta },
          React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, `${NUMBER_LABEL[type] ?? 'No.'}: `),
          type === 'sales_invoice' ? data.bill_number || data.invoice_number : data.invoice_number
        ),
        React.createElement(Text, { style: styles.compactInvoiceMeta },
          React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Date: '),
          formatGstDate(data.issue_date)
        )
      )
    )
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return React.createElement(View, { style: styles.totalRow },
    React.createElement(Text, { style: bold ? styles.totalLabelBold : styles.totalLabel }, label),
    React.createElement(Text, { style: bold ? styles.totalValueBold : styles.totalValue }, value)
  );
}

function displayGstRate(items: InvoiceItem[]): string {
  const rates = [...new Set(items.map((i) => (i.gst_rate == null ? 18 : Number(i.gst_rate))))];
  return rates.length === 1 ? `${rates[0]}%` : 'mixed';
}

/** Totals for the last page, built from the stored (server-computed) amounts. */
function TotalsBlock({ data }: { data: InvoiceData }) {
  const rows: React.ReactElement[] = [];
  const add = (label: string, value: string, bold = false) =>
    rows.push(React.createElement(TotalRow, { key: label, label, value, bold }));

  if (data.discount_amount > 0) {
    add(
      data.extra_discount_type === 'percent' ? `Extra Discount (${data.extra_discount_value}%):` : 'Extra Discount:',
      `- ${formatIndianCurrency(data.discount_amount)}`
    );
    add('Taxable Value:', formatIndianCurrency(data.subtotal - data.discount_amount));
  }
  if (gstRowCount(data) > 0) {
    const rate = displayGstRate(data.items);
    if ((data.supply_type || 'IGST') === 'IGST') {
      add(`IGST (${rate}):`, formatIndianCurrency(data.tax_amount));
    } else {
      const half = rate === 'mixed' ? 'mixed' : `${parseFloat(rate) / 2}%`;
      add(`CGST (${half}):`, formatIndianCurrency(data.tax_amount / 2));
      add(`SGST (${half}):`, formatIndianCurrency(data.tax_amount / 2));
    }
  }
  if ((data.postage_charge ?? 0) > 0) add('Postage / Delivery Charges:', formatIndianCurrency(data.postage_charge!));
  if ((data.other_charges ?? 0) > 0) add(`${data.other_charges_label || 'Other Charges'}:`, formatIndianCurrency(data.other_charges!));
  if ((data.round_off ?? 0) !== 0) add('Round Off:', `${data.round_off! > 0 ? '+' : '-'} ${formatIndianCurrency(Math.abs(data.round_off!))}`);
  add(data.tax_amount > 0 ? 'Total Amount (with Tax):' : 'Total Amount:', formatIndianCurrency(data.total), true);
  if (isSalesInvoice(data)) {
    rows.push(React.createElement(View, { key: 'igst-output', style: styles.igstOutputRow },
      React.createElement(Text, { style: styles.igstOutputLabel }, (data.supply_type || 'IGST') === 'IGST' ? 'IGST OUTPUT' : 'CGST + SGST OUTPUT')
    ));
  }
  if (data.is_bill && data.payment_mode === 'credit' && (data.amount_paid ?? 0) > 0) {
    add('Amount Paid:', formatIndianCurrency(data.amount_paid!));
    add('Balance Due:', formatIndianCurrency(data.balance_due ?? 0), true);
  }
  return React.createElement(React.Fragment, null, ...rows);
}

function AmountInWordsRow({ total }: { total: number }) {
  return React.createElement(View, { style: styles.wordsRow },
    React.createElement(Text, { style: styles.wordsText },
      React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Total Amount in Words: '),
      convertToIndianWords(total)
    )
  );
}

function RemarksAndDispatch({ data }: { data: InvoiceData }) {
  const remarks = docRemarks(data);
  const dispatch = dispatchLines(data);
  if (!remarks && dispatch.length === 0) return null;
  return React.createElement(View, { style: { paddingHorizontal: 8, paddingTop: 4 } },
    remarks
      ? React.createElement(Text, { style: { fontSize: 7.5, color: '#475569', fontFamily: 'Helvetica-Oblique', marginBottom: 4 } }, remarks)
      : null,
    dispatch.length
      ? React.createElement(View, { style: { borderWidth: 0.5, borderColor: BORDER, backgroundColor: '#F8FAFC', padding: 5 } },
          React.createElement(Text, { style: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 } }, 'Dispatch Details'),
          ...dispatch.map((line, i) => React.createElement(Text, { key: i, style: { fontSize: 7.5, color: '#374151' } }, line))
        )
      : null
  );
}

function BankAndSignatorySection({ data }: { data: InvoiceData }) {
  // Our bank details only make sense on documents we send to customers.
  const hasBankDetails = data.side !== 'purchase' && (data.bank_name || data.bank_account_number || data.bank_ifsc);
  return React.createElement(View, { style: styles.bottomSection },
    React.createElement(View, { style: styles.bottomLeft },
      data.notes
        ? React.createElement(View, { style: { marginBottom: 8 } },
            React.createElement(Text, { style: styles.sectionLabel }, 'Notes:'),
            React.createElement(Text, { style: { fontSize: 8, color: '#374151', lineHeight: 1.5 } }, data.notes)
          )
        : null,
      hasBankDetails
        ? React.createElement(View, null,
            React.createElement(Text, { style: styles.sectionLabel }, 'Bank Details:'),
            data.bank_name
              ? React.createElement(Text, { style: styles.bankDetail }, `Bank Name: ${data.bank_name}`)
              : null,
            data.bank_account_number
              ? React.createElement(Text, { style: styles.bankDetail }, `Account No: ${data.bank_account_number}`)
              : null,
            data.bank_ifsc
              ? React.createElement(Text, { style: styles.bankDetail }, `IFSC: ${data.bank_ifsc}`)
              : null,
            data.bank_branch
              ? React.createElement(Text, { style: styles.bankDetail }, `Branch: ${data.bank_branch}`)
              : null
          )
        : null
    ),
    React.createElement(View, { style: styles.bottomRight },
      React.createElement(Text, { style: styles.forCompany }, `For ${data.business_name || 'Company'}`),
      data.signature_url
        ? React.createElement(Image as any, {
            src: data.signature_url,
            style: { width: 120, height: 50, objectFit: 'contain', marginBottom: 2 }
          })
        : null,
      React.createElement(View, { style: styles.signLine }),
      React.createElement(Text, { style: styles.signLabel }, 'Authorized Signatory'),
      data.signatory_name
        ? React.createElement(Text, { style: styles.signName }, data.signatory_name)
        : null
    )
  );
}

function GSTINLine({ gstin }: { gstin?: string }) {
  if (!gstin) return null;
  return React.createElement(Text, { style: styles.gstinBottom }, `GSTIN: ${gstin}`);
}

function TermsAndConditions() {
  return React.createElement(View, { style: styles.termsContainer },
    React.createElement(Text, { style: styles.termsTitle }, 'Terms & Conditions'),
    React.createElement(Text, { style: styles.termsText }, '1. Goods once sold will not be taken back or exchanged under any circumstances unless prior written approval has been obtained.'),
    React.createElement(Text, { style: styles.termsText }, '2. Payment is due within the period mentioned above; a late payment fee of 2% per month will be charged on overdue amounts.'),
    React.createElement(Text, { style: styles.termsText }, '3. All disputes are subject to local jurisdiction only and shall be resolved as per the applicable laws of the land.'),
    React.createElement(Text, { style: styles.termsText }, '4. The seller shall not be liable for any delay in delivery due to circumstances beyond reasonable control, including acts of nature.'),
    React.createElement(Text, { style: styles.termsText }, '5. This invoice is computer generated and is valid without a physical signature unless otherwise specified by the issuing authority.')
  );
}

function PageFooter({ current, total, biz }: { current: number; total: number; biz: string }) {
  return React.createElement(View, { style: styles.pageFooter },
    React.createElement(Text, { style: styles.footerText }, biz),
    React.createElement(Text, { style: styles.footerText }, `Page ${current} of ${total}`)
  );
}

// ─── Main document builder ────────────────────────────────────────────────────

function createGstInvoiceDocument(data: InvoiceData) {
  const itemsWithSerial: SerializedItem[] = (data.items || []).map((item, index) => ({
    ...item,
    serial: index + 1,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    amount: Number(item.amount) || 0,
  }));

  const chunks = splitItemsDynamically(itemsWithSerial, data);
  const bizName = data.business_name || 'QuickInvoice';
  const totalPages = chunks.length;

  let runningTotal = 0;
  const pageSubtotals: number[] = chunks.map(chunk => {
    runningTotal += chunk.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    return runningTotal;
  });

  const pageElements = chunks.map((pageItems, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === chunks.length - 1;
    const pageNumber = pageIndex + 1;
    const bfAmount = pageIndex > 0 ? pageSubtotals[pageIndex - 1] : 0;
    const cumulativeSubtotal = isLastPage ? data.subtotal : pageSubtotals[pageIndex];

    return React.createElement(Page, { key: pageIndex, size: 'A4', style: styles.page, wrap: false },
      React.createElement(View, { style: styles.outerBorder },

        // ── HEADER SECTION — pinned to top ──
        React.createElement(View, { style: styles.headerSection },
          isFirstPage
            ? React.createElement(FullHeader, { data, biz: bizName })
            : React.createElement(CompactHeader, { data, biz: bizName }),
          isFirstPage
            ? React.createElement(ClientInfoSection, { data })
            : null,
          React.createElement(TableColumnHeaderRow, null),
          !isFirstPage
            ? React.createElement(BFRow, { amount: bfAmount })
            : null
        ),

        // ── ITEMS SECTION — fills space between header and footer ──
        React.createElement(View, { style: styles.itemsSection },
          ...pageItems.map((item) =>
            React.createElement(ItemRow, { key: item.serial, item, showBookMetadata: data.show_book_metadata })
          )
        ),

        // ── FOOTER SECTION — pinned to bottom ──
        React.createElement(View, { style: styles.footerSection },
          React.createElement(TotalRow, { label: 'Subtotal:', value: formatIndianCurrency(cumulativeSubtotal) }),
          isLastPage ? React.createElement(TotalsBlock, { data }) : null,
          isLastPage ? React.createElement(AmountInWordsRow, { total: data.total }) : null,
          isLastPage ? React.createElement(RemarksAndDispatch, { data }) : null,
          React.createElement(BankAndSignatorySection, { data }),
          isLastPage ? React.createElement(GSTINLine, { gstin: data.gstin }) : null,
          isLastPage && isSalesInvoice(data) ? React.createElement(TermsAndConditions, null) : null,
          React.createElement(PageFooter, { current: pageNumber, total: totalPages, biz: bizName })
        )
      )
    );
  });

  return React.createElement(Document, null, ...pageElements);
}

// ─── Service class ────────────────────────────────────────────────────────────

export class PdfService {
  async generatePdf(invoiceData: InvoiceData): Promise<Buffer> {
    const data: InvoiceData = {
      ...invoiceData,
      subtotal: Number(invoiceData.subtotal) || 0,
      tax_amount: Number(invoiceData.tax_amount) || 0,
      discount_amount: Number(invoiceData.discount_amount) || 0,
      total: Number(invoiceData.total) || 0,
      items: (invoiceData.items || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        amount: Number(item.amount),
      })),
    };

    if (data.logo_url) {
      data.logo_url = await getImageAsBase64(data.logo_url) || undefined;
    }
    if (data.signature_url) {
      data.signature_url = await getImageAsBase64(data.signature_url) || undefined;
    }
    const doc = createGstInvoiceDocument(data);
    const buffer = await renderToBuffer(doc as any);
    return Buffer.from(buffer);
  }

  async generateAndUpload(orgId: string, docId: string, invoiceData: InvoiceData): Promise<string> {
    const pdfBuffer = await this.generatePdf(invoiceData);
    const url = await storageService.uploadPdf(orgId, docId, pdfBuffer);
    await prisma.invoice.update({ where: { id: docId }, data: { pdfUrl: url } });
    return url;
  }
}

export const pdfService = new PdfService();
