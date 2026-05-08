import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

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

export class ReportService {
  async generateSalesReport(data: any, profile: ReportProfile, month: number, year: number): Promise<Buffer> {
    const doc = SalesReportDoc({ data, profile, month, year }) as React.ReactElement;
    return renderToBuffer(doc as any);
  }

  async generatePurchaseReport(data: any, profile: ReportProfile, month: number, year: number): Promise<Buffer> {
    const doc = PurchaseReportDoc({ data, profile, month, year }) as React.ReactElement;
    return renderToBuffer(doc as any);
  }
}

export const reportService = new ReportService();
