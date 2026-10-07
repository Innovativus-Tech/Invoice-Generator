import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { getImageAsBase64 } from './pdf.service.js';

const NAVY = '#1E293B';
const GRAY = '#64748B';
const BORDER = '#E2E8F0';
const PRIMARY = '#6C63FF';

const rs = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 40, height: 40 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  reportTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4 },
  reportSubtitle: { fontSize: 9, color: GRAY },
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: BORDER, borderRadius: 6, padding: 12 },
  cardLabel: { fontSize: 7, color: GRAY, marginBottom: 4, textTransform: 'uppercase' as any },
  cardValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 8, marginTop: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: BORDER, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase' as any },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 6, paddingHorizontal: 8 },
  tableCell: { fontSize: 8, color: NAVY },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY },
  disclaimer: { position: 'absolute', bottom: 50, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#CBD5E1', paddingTop: 8 },
  disclaimerText: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#6B7280' },
});

const formatINR = (n: number) =>
  'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface ReportProfile {
  business_name?: string;
  logo_url?: string;
  gstin?: string;
}

// ─── Sales Report ─────────────────────────────────────────────────────────────
function SalesReportDoc({ data, profile, month, year }: {
  data: any; profile: ReportProfile; month: number; year: number;
}) {
  const monthLabel = `${monthNames[month - 1]} ${year}`;
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: rs.page },
      // Header
      React.createElement(View, { style: rs.header },
        React.createElement(View, { style: rs.headerLeft },
          profile.logo_url
            ? React.createElement(Image, { src: profile.logo_url, style: rs.logo })
            : null,
          React.createElement(View, {},
            React.createElement(Text, { style: rs.companyName }, profile.business_name || 'QuickInvoice'),
            React.createElement(Text, { style: rs.reportSubtitle }, profile.gstin ? `GSTIN: ${profile.gstin}` : '')
          )
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' as any } },
          React.createElement(Text, { style: rs.reportTitle }, 'Sales Report'),
          React.createElement(Text, { style: rs.reportSubtitle }, monthLabel),
          React.createElement(Text, { style: { ...rs.reportSubtitle, marginTop: 2 } }, `Generated: ${generatedDate}`)
        )
      ),
      // Summary Cards
      React.createElement(View, { style: rs.cardsRow },
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Total Revenue'),
          React.createElement(Text, { style: rs.cardValue }, formatINR(data.total_revenue))
        ),
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Invoices Paid'),
          React.createElement(Text, { style: rs.cardValue }, String(data.invoice_count))
        ),
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Average Invoice'),
          React.createElement(Text, { style: rs.cardValue }, formatINR(data.average_invoice_value))
        )
      ),
      // All Paid Invoices
      React.createElement(Text, { style: rs.sectionTitle }, `Paid Invoices \u2014 ${monthLabel}`),
      React.createElement(View, { style: rs.tableHeader },
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 100, paddingRight: 6 } }, 'Invoice No'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, flex: 1, paddingHorizontal: 6 } }, 'Client'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 80, paddingHorizontal: 6 } }, 'Date'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 90, textAlign: 'right' as any, paddingLeft: 6 } }, 'Amount')
      ),
      ...(data.invoices || []).map((inv: any, i: number) =>
        React.createElement(View, { key: i, style: rs.tableRow, wrap: false },
          React.createElement(Text, { style: { ...rs.tableCell, width: 100, paddingRight: 6 } }, inv.invoice_number),
          React.createElement(Text, { style: { ...rs.tableCell, flex: 1, paddingHorizontal: 6 } }, (inv.clients as any)?.name || 'N/A'),
          React.createElement(Text, { style: { ...rs.tableCell, width: 80, paddingHorizontal: 6 } }, new Date(inv.paid_at || inv.issue_date).toLocaleDateString('en-IN')),
          React.createElement(Text, { style: { ...rs.tableCell, width: 90, textAlign: 'right' as any, paddingLeft: 6 } }, formatINR(Number(inv.total)))
        )
      ),
      // Disclaimer
      React.createElement(View, { style: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#CBD5E1' } },
        React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#6B7280' } },
          'Note: All amounts are approximate. Actual figures may vary by \u00B15% due to rounding, pending transactions, tax adjustments, or late payment entries. This report is generated for informational purposes only.'
        )
      ),
      // Footer
      React.createElement(View, { style: rs.footer, fixed: true },
        React.createElement(Text, { style: rs.footerText }, profile.business_name || 'QuickInvoice'),
        React.createElement(Text, { style: rs.footerText, render: ({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}` })
      )
    )
  );
}

// ─── Purchase Report ──────────────────────────────────────────────────────────
function PurchaseReportDoc({ data, profile, month, year }: {
  data: any; profile: ReportProfile; month: number; year: number;
}) {
  const monthLabel = `${monthNames[month - 1]} ${year}`;
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: rs.page },
      // Header
      React.createElement(View, { style: rs.header },
        React.createElement(View, { style: rs.headerLeft },
          profile.logo_url
            ? React.createElement(Image, { src: profile.logo_url, style: rs.logo })
            : null,
          React.createElement(View, {},
            React.createElement(Text, { style: rs.companyName }, profile.business_name || 'QuickInvoice'),
            React.createElement(Text, { style: rs.reportSubtitle }, profile.gstin ? `GSTIN: ${profile.gstin}` : '')
          )
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' as any } },
          React.createElement(Text, { style: rs.reportTitle }, 'Purchase Report'),
          React.createElement(Text, { style: rs.reportSubtitle }, monthLabel),
          React.createElement(Text, { style: { ...rs.reportSubtitle, marginTop: 2 } }, `Generated: ${generatedDate}`)
        )
      ),
      // Summary Cards
      React.createElement(View, { style: rs.cardsRow },
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Total Spent'),
          React.createElement(Text, { style: rs.cardValue }, formatINR(data.total_spent))
        ),
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Orders'),
          React.createElement(Text, { style: rs.cardValue }, String(data.order_count))
        ),
        React.createElement(View, { style: rs.card },
          React.createElement(Text, { style: rs.cardLabel }, 'Average Order'),
          React.createElement(Text, { style: rs.cardValue }, formatINR(data.average_order_value))
        )
      ),
      // All Purchase Orders
      React.createElement(Text, { style: rs.sectionTitle }, `Purchase Orders \u2014 ${monthLabel}`),
      React.createElement(View, { style: rs.tableHeader },
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 80, paddingRight: 6 } }, 'Order ID'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, flex: 1, paddingHorizontal: 6 } }, 'Vendor'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 90, paddingHorizontal: 6 } }, 'Item'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 35, textAlign: 'center' as any, paddingHorizontal: 4 } }, 'Qty'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 65, textAlign: 'right' as any, paddingHorizontal: 6 } }, 'Unit Rs.'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 75, textAlign: 'right' as any, paddingRight: 12 } }, 'Total'),
        React.createElement(Text, { style: { ...rs.tableHeaderCell, width: 65, paddingLeft: 12 } }, 'Date')
      ),
      ...(data.orders || []).map((o: any, i: number) =>
        React.createElement(View, { key: i, style: rs.tableRow, wrap: false },
          React.createElement(Text, { style: { ...rs.tableCell, width: 80, fontFamily: 'Courier', paddingRight: 6 } }, o.order_id),
          React.createElement(Text, { style: { ...rs.tableCell, flex: 1, paddingHorizontal: 6 } }, o.client_name),
          React.createElement(Text, { style: { ...rs.tableCell, width: 90, paddingHorizontal: 6 } }, o.item_name),
          React.createElement(Text, { style: { ...rs.tableCell, width: 35, textAlign: 'center' as any, paddingHorizontal: 4 } }, String(o.quantity)),
          React.createElement(Text, { style: { ...rs.tableCell, width: 65, textAlign: 'right' as any, paddingHorizontal: 6 } }, formatINR(Number(o.unit_price))),
          React.createElement(Text, { style: { ...rs.tableCell, width: 75, textAlign: 'right' as any, paddingRight: 12 } }, formatINR(Number(o.total_amount))),
          React.createElement(Text, { style: { ...rs.tableCell, width: 65, paddingLeft: 12 } }, new Date(o.purchase_date).toLocaleDateString('en-IN'))
        )
      ),
      // Disclaimer
      React.createElement(View, { style: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#CBD5E1' } },
        React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#6B7280' } },
          'Note: All amounts are approximate. Actual figures may vary by \u00B15% due to rounding, pending transactions, tax adjustments, or late payment entries. This report is generated for informational purposes only.'
        )
      ),
      // Footer
      React.createElement(View, { style: rs.footer, fixed: true },
        React.createElement(Text, { style: rs.footerText }, profile.business_name || 'QuickInvoice'),
        React.createElement(Text, { style: rs.footerText, render: ({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}` })
      )
    )
  );
}


// ─── Period Report (monthly / yearly / financial year) ───────────────────────

function KV({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return React.createElement(View, { style: { flexDirection: 'row' as any, justifyContent: 'space-between' as any, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: BORDER } },
    React.createElement(Text, { style: { fontSize: 8, color: bold ? NAVY : GRAY, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' } }, label),
    React.createElement(Text, { style: { fontSize: 8, color: NAVY, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' } }, value)
  );
}

function SimpleTable({ columns, rows }: { columns: { label: string; width?: number; align?: 'left' | 'right' | 'center' }[]; rows: string[][] }) {
  const cell = (c: { width?: number; align?: string }) => ({
    ...(c.width ? { width: c.width } : { flex: 1 }),
    textAlign: (c.align ?? 'left') as any,
    paddingHorizontal: 4,
  });
  return React.createElement(View, {},
    React.createElement(View, { style: rs.tableHeader },
      ...columns.map((c, i) => React.createElement(Text, { key: i, style: { ...rs.tableHeaderCell, ...cell(c) } }, c.label))
    ),
    ...(rows.length
      ? rows.map((r, ri) => React.createElement(View, { key: ri, style: rs.tableRow, wrap: false },
          ...r.map((v, ci) => React.createElement(Text, { key: ci, style: { ...rs.tableCell, ...cell(columns[ci]) } }, v))
        ))
      : [React.createElement(Text, { key: 'empty', style: { fontSize: 8, color: GRAY, padding: 8 } }, 'No data for this period')])
  );
}

function PeriodReportDoc({ data, profile }: { data: any; profile: ReportProfile }) {
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const periodName = data.period === 'month' ? 'Monthly' : data.period === 'fy' ? 'Financial Year' : 'Yearly';
  const s = data.sales;
  const p = data.purchases;
  const card = (label: string, value: string) =>
    React.createElement(View, { style: rs.card },
      React.createElement(Text, { style: rs.cardLabel }, label),
      React.createElement(Text, { style: rs.cardValue }, value)
    );

  return React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: rs.page },
      React.createElement(View, { style: rs.header },
        React.createElement(View, { style: rs.headerLeft },
          profile.logo_url ? React.createElement(Image, { src: profile.logo_url, style: rs.logo }) : null,
          React.createElement(View, {},
            React.createElement(Text, { style: rs.companyName }, profile.business_name || 'QuickInvoice'),
            React.createElement(Text, { style: rs.reportSubtitle }, profile.gstin ? `GSTIN: ${profile.gstin}` : '')
          )
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' as any } },
          React.createElement(Text, { style: rs.reportTitle }, 'Sales & Purchase Report'),
          React.createElement(Text, { style: rs.reportSubtitle }, `${periodName} · ${data.label} (${data.from} to ${data.to})`),
          React.createElement(Text, { style: { ...rs.reportSubtitle, marginTop: 2 } }, `Generated: ${generatedDate}`)
        )
      ),
      React.createElement(View, { style: rs.cardsRow },
        card('Net Sales', formatINR(s.net)),
        card('Net Purchases', formatINR(p.net)),
        card('Collections', formatINR(data.collections)),
        card('Est. Gross Margin', formatINR(data.margin.gross_margin))
      ),
      React.createElement(View, { style: { flexDirection: 'row' as any, gap: 16 } },
        React.createElement(View, { style: { flex: 1 } },
          React.createElement(Text, { style: rs.sectionTitle }, 'Sales'),
          React.createElement(KV, { label: `Sales invoices (${s.count})`, value: formatINR(s.gross) }),
          React.createElement(KV, { label: 'Cash sales', value: formatINR(s.cash) }),
          React.createElement(KV, { label: 'Credit sales', value: formatINR(s.credit) }),
          React.createElement(KV, { label: 'Extra discount given', value: formatINR(s.discount) }),
          React.createElement(KV, { label: 'GST collected', value: formatINR(s.tax) }),
          React.createElement(KV, { label: 'Postage / delivery charged', value: formatINR(s.postage) }),
          React.createElement(KV, { label: `Sales returns (${s.returns_count})`, value: `- ${formatINR(s.returns)}` }),
          React.createElement(KV, { label: 'Credit notes', value: `- ${formatINR(s.credit_notes)}` }),
          React.createElement(KV, { label: 'Net sales', value: formatINR(s.net), bold: true })
        ),
        React.createElement(View, { style: { flex: 1 } },
          React.createElement(Text, { style: rs.sectionTitle }, 'Purchases'),
          React.createElement(KV, { label: `Purchase bills (${p.count})`, value: formatINR(p.gross) }),
          React.createElement(KV, { label: 'Cash purchases', value: formatINR(p.cash) }),
          React.createElement(KV, { label: 'Credit purchases', value: formatINR(p.credit) }),
          React.createElement(KV, { label: 'Copies received / damaged', value: `${p.qty} / ${p.damaged_qty}` }),
          React.createElement(KV, { label: `Purchase returns (${p.returns_count})`, value: `- ${formatINR(p.returns)}` }),
          React.createElement(KV, { label: 'Debit notes', value: `- ${formatINR(p.debit_notes)}` }),
          React.createElement(KV, { label: 'Net purchases', value: formatINR(p.net), bold: true }),
          React.createElement(KV, { label: `Quick purchases / expenses (${p.quick_purchase_count})`, value: formatINR(p.quick_purchases) }),
          React.createElement(KV, { label: 'Payments made', value: formatINR(data.payments_out) })
        )
      ),
      React.createElement(Text, { style: rs.sectionTitle }, data.period === 'month' ? 'Day-wise Breakdown' : 'Month-wise Breakdown'),
      React.createElement(SimpleTable, {
        columns: [
          { label: data.period === 'month' ? 'Day' : 'Month', width: 60 },
          { label: 'Sales', align: 'right' }, { label: 'Returns', align: 'right' }, { label: 'Net Sales', align: 'right' },
          { label: 'Purchases', align: 'right' }, { label: 'Collections', align: 'right' },
        ],
        rows: data.breakdown
          .filter((b: any) => data.period !== 'month' || b.sales || b.purchases || b.sales_returns || b.collections)
          .map((b: any) => [b.label, formatINR(b.sales), formatINR(b.sales_returns), formatINR(b.net_sales), formatINR(b.purchases), formatINR(b.collections)]),
      }),
      React.createElement(Text, { style: rs.sectionTitle }, 'Top Customers'),
      React.createElement(SimpleTable, {
        columns: [{ label: 'Party' }, { label: 'Bills', width: 40, align: 'center' }, { label: 'Sales', width: 80, align: 'right' }, { label: 'Returns', width: 70, align: 'right' }, { label: 'Net', width: 80, align: 'right' }],
        rows: data.top_customers.map((c: any) => [c.name, String(c.count), formatINR(c.sales), formatINR(c.returns), formatINR(c.net)]),
      }),
      React.createElement(Text, { style: rs.sectionTitle }, 'Top Suppliers / Binders'),
      React.createElement(SimpleTable, {
        columns: [{ label: 'Party' }, { label: 'Bills', width: 40, align: 'center' }, { label: 'Purchases', width: 80, align: 'right' }, { label: 'Returns', width: 70, align: 'right' }, { label: 'Net', width: 80, align: 'right' }],
        rows: data.top_suppliers.map((c: any) => [c.name, String(c.count), formatINR(c.purchases), formatINR(c.returns), formatINR(c.net)]),
      }),
      React.createElement(Text, { style: rs.sectionTitle }, 'Best-selling Titles'),
      React.createElement(SimpleTable, {
        columns: [{ label: 'Title' }, { label: 'Copies', width: 60, align: 'right' }, { label: 'Amount', width: 90, align: 'right' }],
        rows: data.top_items.map((i: any) => [i.description, String(i.qty), formatINR(i.amount)]),
      }),
      React.createElement(View, { style: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#CBD5E1' } },
        React.createElement(Text, { style: { fontSize: 7.5, fontFamily: 'Helvetica-Oblique', color: '#6B7280' } },
          'Gross margin is estimated from the current purchase rate of each title and covers only lines linked to inventory. Pending (unapproved) and cancelled documents are excluded.'
        )
      ),
      React.createElement(View, { style: rs.footer, fixed: true },
        React.createElement(Text, { style: rs.footerText }, profile.business_name || 'QuickInvoice'),
        React.createElement(Text, { style: rs.footerText, render: ({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}` })
      )
    )
  );
}

export class ReportService {
  async generateSalesReport(data: any, profile: ReportProfile, month: number, year: number): Promise<Buffer> {
    const doc = SalesReportDoc({ data, profile, month, year }) as React.ReactElement;
    return renderToBuffer(doc as any);
  }

  async generatePurchaseReport(data: any, profile: ReportProfile, month: number, year: number): Promise<Buffer> {
    const doc = PurchaseReportDoc({ data, profile, month, year }) as React.ReactElement;
    return renderToBuffer(doc as any);
  }

  async generatePeriodReport(data: any, profile: ReportProfile): Promise<Buffer> {
    const logo = await getImageAsBase64(profile.logo_url);
    const doc = PeriodReportDoc({ data, profile: { ...profile, logo_url: logo ?? undefined } }) as React.ReactElement;
    return Buffer.from(await renderToBuffer(doc as any));
  }
}

export const reportService = new ReportService();
