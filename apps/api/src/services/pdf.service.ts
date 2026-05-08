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
}

interface SerializedItem extends InvoiceItem {
  serial: number;
}

interface InvoiceData {
  invoice_number: string;
  bill_number?: string;
  status: string;
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
  supply_type?: string;
  place_of_supply?: string;
  items: InvoiceItem[];
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
  logo_url?: string;
  signature_url?: string;
  signatory_name?: string;
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

const A4_USABLE = 841.89 - 40 - 2;

const FULL_HEADER_HEIGHT = 165;
const CLIENT_INFO_HEIGHT = 68;
const TABLE_COL_HEADER_HEIGHT = 18;
const COMPACT_HEADER_HEIGHT = 56;
const BF_ROW_HEIGHT = 20;

const SUBTOTAL_ROW_HEIGHT = 18;
const BANK_SIGNATORY_HEIGHT = 105;
const PAGE_FOOTER_HEIGHT = 18;

const IGST_ROW_HEIGHT = 18;
const TOTAL_WITH_TAX_ROW_HEIGHT = 19;
const IGST_OUTPUT_ROW_HEIGHT = 18;
const AMOUNT_IN_WORDS_HEIGHT = 24;
const GSTIN_LINE_HEIGHT = 21;
const TERMS_HEIGHT = 105;

const NON_LAST_FOOTER_HEIGHT = SUBTOTAL_ROW_HEIGHT + BANK_SIGNATORY_HEIGHT + PAGE_FOOTER_HEIGHT;

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

const PAGE1_ITEMS_AVAIL = A4_USABLE - FULL_HEADER_HEIGHT - CLIENT_INFO_HEIGHT - TABLE_COL_HEADER_HEIGHT - NON_LAST_FOOTER_HEIGHT;
const MIDDLE_ITEMS_AVAIL = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - NON_LAST_FOOTER_HEIGHT;
const LAST_ITEMS_AVAIL = A4_USABLE - COMPACT_HEADER_HEIGHT - TABLE_COL_HEADER_HEIGHT - BF_ROW_HEIGHT - LAST_FOOTER_HEIGHT;
const SINGLE_PAGE_ITEMS_AVAIL = A4_USABLE - FULL_HEADER_HEIGHT - CLIENT_INFO_HEIGHT - TABLE_COL_HEADER_HEIGHT - LAST_FOOTER_HEIGHT;

function estimateItemHeight(item: InvoiceItem | SerializedItem): number {
  const desc = item.description || '';
  if (desc.length > 70) return 38;
  if (desc.length > 35) return 28;
  return 20;
}

function takeItemsThatFit<T extends InvoiceItem>(items: T[], availHeight: number): T[] {
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

function willFitOnLastPage<T extends InvoiceItem>(items: T[], lastAvailHeight: number): boolean {
  const totalHeight = items.reduce((sum, item) => sum + estimateItemHeight(item), 0);
  return totalHeight <= lastAvailHeight;
}

function splitItemsDynamically(items: SerializedItem[]): SerializedItem[][] {
  if (items.length === 0) return [[]];

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
    return [items];
  }

  // Middle + last pages
  while (remaining.length > 0) {
    if (willFitOnLastPage(remaining, LAST_ITEMS_AVAIL)) {
      chunks.push(remaining);
      break;
    }

    const pageItems = takeItemsThatFit(remaining, MIDDLE_ITEMS_AVAIL);

    if (pageItems.length === 0) {
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

function ItemRow({ item }: { item: any }) {
  const disc = item.discount_percent ?? 0;
  return React.createElement(View, { style: styles.dataRow, wrap: false },
    React.createElement(Text, { style: [styles.td, styles.colSI] }, String(item.serial)),
    React.createElement(Text, { style: [styles.td, styles.colDesc] }, item.description),
    React.createElement(Text, { style: [styles.td, styles.colHSN] }, item.hsn_sac || ''),
    React.createElement(Text, { style: [styles.td, styles.colGST] }, item.gst_rate ? `${item.gst_rate}%` : ''),
    React.createElement(Text, { style: [styles.td, styles.colQty] }, `${item.quantity}`),
    React.createElement(Text, { style: [styles.td, styles.colRate] }, formatIndianCurrency(item.unit_price)),
    React.createElement(Text, { style: [styles.td, styles.colDisc] }, disc > 0 ? `${disc}%` : '\u2013'),
    React.createElement(Text, { style: [styles.td, styles.colAmt] }, formatIndianCurrency(item.amount))
  );
}

function FullHeader({ data, biz }: { data: InvoiceData; biz: string }) {
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
        React.createElement(Text, { style: styles.invoiceTitle }, 'Invoice'),
        React.createElement(Text, { style: styles.invoiceMeta },
          React.createElement(Text, { style: styles.invoiceMetaLabel }, 'Bill No.: '),
          data.bill_number || data.invoice_number
        ),
        React.createElement(Text, { style: styles.invoiceMeta },
          React.createElement(Text, { style: styles.invoiceMetaLabel }, 'Date: '),
          formatGstDate(data.issue_date)
        ),
        data.order_id
          ? React.createElement(Text, { style: styles.invoiceMeta },
              React.createElement(Text, { style: styles.invoiceMetaLabel }, 'Order ID: '),
              data.order_id
            )
          : null,
        data.order_date
          ? React.createElement(Text, { style: styles.invoiceMeta },
              React.createElement(Text, { style: styles.invoiceMetaLabel }, 'Order Date: '),
              formatGstDate(data.order_date)
            )
          : null
      )
    )
  );
}

function ClientInfoSection({ data }: { data: InvoiceData }) {
  return React.createElement(View, { style: styles.billSection },
    React.createElement(View, { style: styles.billLeft },
      React.createElement(Text, { style: [styles.billToLabel, { marginBottom: 6 }] }, 'To,'),
      React.createElement(Text, { style: styles.billName }, data.client_name || 'N/A'),
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
        : null
    ),
    data.place_of_supply
      ? React.createElement(View, { style: styles.billRight },
          React.createElement(Text, { style: styles.billDetail },
            React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Place of Supply: '),
            data.place_of_supply
          )
        )
      : null
  );
}

function CompactHeader({ data, biz }: { data: InvoiceData; biz: string }) {
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
        React.createElement(Text, { style: styles.compactInvoiceTitle }, 'Invoice'),
        React.createElement(Text, { style: styles.compactInvoiceMeta },
          React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Bill No.: '),
          data.bill_number || data.invoice_number
        ),
        React.createElement(Text, { style: styles.compactInvoiceMeta },
          React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Date: '),
          formatGstDate(data.issue_date)
        )
      )
    )
  );
}

function SubtotalRow({ amount }: { amount: number }) {
  return React.createElement(View, { style: styles.subtotalRow },
    React.createElement(Text, { style: styles.totalLabel }, 'Subtotal:'),
    React.createElement(Text, { style: styles.totalValue }, formatIndianCurrency(amount))
  );
}

function IGSTRow({ data, subtotal }: { data: InvoiceData; subtotal: number }) {
  const supplyType = data.supply_type || 'IGST';
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const halfRate = commonRate / 2;

  if (supplyType === 'IGST') {
    return React.createElement(View, { style: styles.totalRow },
      React.createElement(Text, { style: styles.totalLabel }, `IGST (${commonRate}%):`),
      React.createElement(Text, { style: styles.totalValue }, formatIndianCurrency(totalGstAmount))
    );
  }
  return React.createElement(React.Fragment, null,
    React.createElement(View, { style: styles.totalRow },
      React.createElement(Text, { style: styles.totalLabel }, `CGST (${halfRate}%):`),
      React.createElement(Text, { style: styles.totalValue }, formatIndianCurrency(totalGstAmount / 2))
    ),
    React.createElement(View, { style: styles.totalRow },
      React.createElement(Text, { style: styles.totalLabel }, `SGST (${halfRate}%):`),
      React.createElement(Text, { style: styles.totalValue }, formatIndianCurrency(totalGstAmount / 2))
    )
  );
}

function TotalWithTaxRow({ subtotal, data }: { subtotal: number; data: InvoiceData }) {
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const total = subtotal + totalGstAmount;
  return React.createElement(View, { style: styles.totalRow },
    React.createElement(Text, { style: styles.totalLabelBold }, 'Total Amount (with Tax):'),
    React.createElement(Text, { style: styles.totalValueBold }, formatIndianCurrency(total))
  );
}

function IGSTOutputRow() {
  return React.createElement(View, { style: styles.igstOutputRow },
    React.createElement(Text, { style: styles.igstOutputLabel }, 'IGST OUTPUT')
  );
}

function AmountInWordsRow({ subtotal, data }: { subtotal: number; data: InvoiceData }) {
  const commonRate = data.items[0]?.gst_rate || 18;
  const totalGstAmount = subtotal * (commonRate / 100);
  const total = subtotal + totalGstAmount;
  return React.createElement(View, { style: styles.wordsRow },
    React.createElement(Text, { style: styles.wordsText },
      React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold' } }, 'Total Amount in Words: '),
      convertToIndianWords(total)
    )
  );
}

function BankAndSignatorySection({ data }: { data: InvoiceData }) {
  const hasBankDetails = data.bank_name || data.bank_account_number || data.bank_ifsc;
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

  const chunks = splitItemsDynamically(itemsWithSerial);
  const bizName = data.business_name || 'QuickInvoice';
  const totalPages = chunks.length;
  const isSinglePage = totalPages === 1;

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
    const cumulativeSubtotal = pageSubtotals[pageIndex];

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
            React.createElement(ItemRow, { key: item.serial, item })
          )
        ),

        // ── FOOTER SECTION — pinned to bottom ──
        React.createElement(View, { style: styles.footerSection },
          React.createElement(SubtotalRow, { amount: cumulativeSubtotal }),
          (isLastPage || isSinglePage)
            ? React.createElement(IGSTRow, { data, subtotal: cumulativeSubtotal })
            : null,
          (isLastPage || isSinglePage)
            ? React.createElement(TotalWithTaxRow, { subtotal: cumulativeSubtotal, data })
            : null,
          (isLastPage || isSinglePage)
            ? React.createElement(IGSTOutputRow, null)
            : null,
          (isLastPage || isSinglePage)
            ? React.createElement(AmountInWordsRow, { subtotal: cumulativeSubtotal, data })
            : null,
          React.createElement(BankAndSignatorySection, { data }),
          (isLastPage || isSinglePage)
            ? React.createElement(GSTINLine, { gstin: data.gstin })
            : null,
          (isLastPage || isSinglePage)
            ? React.createElement(TermsAndConditions, null)
            : null,
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
    const data = { ...invoiceData };
    if (data.items) {
      data.items = data.items.map((item: any) => ({
        ...item,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        amount: Number(item.amount),
      }));
    } else {
      data.items = [];
    }

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

  async generateAndUpload(userId: string, invoiceId: string, invoiceData: InvoiceData): Promise<string> {
    const pdfBuffer = await this.generatePdf(invoiceData);
    const url = await storageService.uploadPdf(userId, invoiceId, pdfBuffer);
    await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });
    return url;
  }
}

export const pdfService = new PdfService();
