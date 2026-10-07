'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { SalesPurchaseChart } from '@/components/charts/sales-purchase-chart';
import { useExportReportPdf, usePeriodReport } from '@/hooks/use-reports';
import { docPath, docUi } from '@/lib/doc-types';
import { cn, downloadCsv, inr, plural, shortDate, todayISO } from '@/lib/utils';
import type { PeriodReport, ReportPeriod } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Line({ label, value, strong, negative }: { label: string; value: number | string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-2 text-sm border-b border-border last:border-0', strong && 'font-semibold')}>
      <span className={strong ? 'text-text-1' : 'text-text-2'}>{label}</span>
      <span className="text-text-1">{typeof value === 'number' ? `${negative && value > 0 ? '− ' : ''}${inr(value)}` : value}</span>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs text-text-2 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-text-1 mt-1">{value}</p>
      {hint && <p className="text-xs text-text-2 mt-1">{hint}</p>}
    </Card>
  );
}

function exportCsv(r: PeriodReport) {
  downloadCsv(`Sales-Purchase-${r.label.replace(/\s+/g, '-')}.csv`, [
    [`Sales & Purchase Report — ${r.label} (${r.from} to ${r.to})`],
    [],
    [r.period === 'month' ? 'Day' : 'Month', 'Sales', 'Sales returns & credit notes', 'Net sales', 'Purchases', 'Purchase returns & debit notes', 'Collections', 'Payments made'],
    ...r.breakdown.map((b) => [b.label, b.sales, b.sales_returns, b.net_sales, b.purchases, b.purchase_returns, b.collections, b.payments_out]),
    [],
    ['Documents'],
    ['Type', 'Number', 'Date', 'Party', 'Cash/Credit', 'Amount'],
    ...r.documents.map((d) => [docUi(d.doc_type).label, d.invoice_number, d.issue_date, d.party_name, d.payment_mode, d.total]),
  ]);
}

export default function ReportsPage() {
  const today = todayISO();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const { data: r, isLoading, isFetching } = usePeriodReport(period, year, month);
  const exportPdf = useExportReportPdf();

  const yearLabel = period === 'fy' ? `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}` : String(year);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Sales and purchase summary — monthly, yearly or financial year">
        <Button variant="secondary" disabled={!r} onClick={() => r && exportCsv(r)} icon={<FileSpreadsheet className="h-4 w-4" />}>CSV</Button>
        <Button disabled={!r} loading={exportPdf.isPending} onClick={() => r && exportPdf.mutate({ period, year, month, label: r.label })} icon={<Download className="h-4 w-4" />}>PDF</Button>
      </PageHeader>

      <Card padding={false} className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <Segmented<ReportPeriod>
            ariaLabel="Period"
            value={period}
            onChange={setPeriod}
            options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }, { value: 'fy', label: 'Financial year (Apr–Mar)' }]}
          />
          <div className="flex items-center gap-1">
            <button onClick={() => setYear((y) => y - 1)} className="p-1.5 rounded-lg border border-border text-text-2 hover:text-text-1" aria-label="Previous year"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-sm font-semibold text-text-1 min-w-[90px] text-center">{yearLabel}</span>
            <button onClick={() => setYear((y) => y + 1)} className="p-1.5 rounded-lg border border-border text-text-2 hover:text-text-1" aria-label="Next year"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {period === 'month' && (
            <div className="flex flex-wrap gap-1">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMonth(i + 1)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium', month === i + 1 ? 'bg-primary text-white' : 'text-text-2 hover:text-text-1 hover:bg-surface dark:hover:bg-border/30')}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {isLoading || !r ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className={cn('space-y-6 transition-opacity', isFetching && 'opacity-60')}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Net sales" value={inr(r.sales.net)} hint={`${plural(r.sales.count, 'invoice')} · ${plural(r.sales.qty, 'copy', 'copies')}`} />
            <Tile label="Net purchases" value={inr(r.purchases.net)} hint={`${plural(r.purchases.count, 'bill')} · ${plural(r.purchases.qty, 'copy', 'copies')}`} />
            <Tile label="Collections" value={inr(r.collections)} hint={`Payments made ${inr(r.payments_out)}`} />
            <Tile
              label="Est. gross margin"
              value={inr(r.margin.gross_margin)}
              hint={r.margin.revenue > 0 ? `${r.margin.margin_percent}% on titles with a purchase rate` : 'Set purchase rates to see margin'}
            />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-text-1">Sales vs purchases — {r.label}</h3>
              <span className="text-xs text-text-2">{shortDate(r.from)} – {shortDate(r.to)}</span>
            </div>
            <SalesPurchaseChart data={r.breakdown.map((b) => ({ label: b.label, sales: b.net_sales, purchases: b.purchases - b.purchase_returns }))} height={280} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-base font-semibold text-text-1 mb-2">Sales</h3>
              <Line label={`Sales invoices (${r.sales.count})`} value={r.sales.gross} />
              <Line label="Cash sales" value={r.sales.cash} />
              <Line label="Credit sales" value={r.sales.credit} />
              <Line label="Extra discount given" value={r.sales.discount} />
              <Line label="GST charged" value={r.sales.tax} />
              <Line label="Postage / delivery charged" value={r.sales.postage} />
              <Line label={`Sales returns (${r.sales.returns_count})`} value={r.sales.returns} negative />
              <Line label="Credit notes" value={r.sales.credit_notes} negative />
              <Line label="Net sales" value={r.sales.net} strong />
              <Line label={`Estimates (${r.estimates.count}, ${r.estimates.converted} converted)`} value={r.estimates.total} />
              <Line label={`Delivery challans (${r.challans.count}, ${r.challans.converted} invoiced)`} value={r.challans.total} />
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-text-1 mb-2">Purchases</h3>
              <Line label={`Purchase bills (${r.purchases.count})`} value={r.purchases.gross} />
              <Line label="Cash purchases" value={r.purchases.cash} />
              <Line label="Credit purchases" value={r.purchases.credit} />
              <Line label="Copies received / damaged" value={`${r.purchases.qty} / ${r.purchases.damaged_qty}`} />
              <Line label={`Purchase returns (${r.purchases.returns_count})`} value={r.purchases.returns} negative />
              <Line label="Debit notes" value={r.purchases.debit_notes} negative />
              <Line label="Net purchases" value={r.purchases.net} strong />
              <Line label={`Quick purchases / expenses (${r.purchases.quick_purchase_count})`} value={r.purchases.quick_purchases} />
              <Line label="Payments made" value={r.payments_out} />
            </Card>
          </div>

          <Card padding={false}>
            <div className="p-5 pb-3"><h3 className="text-base font-semibold text-text-1">{period === 'month' ? 'Day-wise' : 'Month-wise'} breakdown</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                    <th className="px-5 py-2.5 text-left">{period === 'month' ? 'Day' : 'Month'}</th>
                    <th className="px-5 py-2.5 text-right">Sales</th>
                    <th className="px-5 py-2.5 text-right">Returns</th>
                    <th className="px-5 py-2.5 text-right">Net sales</th>
                    <th className="px-5 py-2.5 text-right">Purchases</th>
                    <th className="px-5 py-2.5 text-right">Collections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.breakdown
                    .filter((b) => period !== 'month' || b.sales || b.purchases || b.sales_returns || b.collections)
                    .map((b) => (
                      <tr key={b.key}>
                        <td className="px-5 py-2 text-text-1">{period === 'month' ? `${b.label} ${MONTHS[month - 1]}` : b.label}</td>
                        <td className="px-5 py-2 text-right">{b.sales ? inr(b.sales) : '—'}</td>
                        <td className="px-5 py-2 text-right text-text-2">{b.sales_returns ? inr(b.sales_returns) : '—'}</td>
                        <td className="px-5 py-2 text-right font-medium">{b.net_sales ? inr(b.net_sales) : '—'}</td>
                        <td className="px-5 py-2 text-right">{b.purchases ? inr(b.purchases) : '—'}</td>
                        <td className="px-5 py-2 text-right">{b.collections ? inr(b.collections) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <RankTable title="Top customers" head={['Party', 'Bills', 'Net']} rows={r.top_customers.map((c) => [c.name, String(c.count), inr(c.net)])} />
            <RankTable title="Top suppliers & binders" head={['Party', 'Bills', 'Net']} rows={r.top_suppliers.map((c) => [c.name, String(c.count), inr(c.net)])} />
            <RankTable title="Best-selling titles" head={['Title', 'Copies', 'Amount']} rows={r.top_items.map((i) => [i.description, String(i.qty), inr(i.amount)])} />
          </div>

          {r.binding_wise.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-text-1 mb-3">Sales by binding</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {r.binding_wise.map((b) => (
                  <div key={b.binding} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-text-2">{b.binding}</p>
                    <p className="text-lg font-semibold text-text-1">{inr(b.amount)}</p>
                    <p className="text-xs text-text-2">{b.qty} copies</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card padding={false}>
            <div className="p-5 pb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-1">Documents in this period ({r.documents.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-card">
                  <tr className="border-y border-border text-xs font-medium text-text-2 uppercase tracking-wider">
                    <th className="px-5 py-2.5 text-left">Type</th>
                    <th className="px-5 py-2.5 text-left">Number</th>
                    <th className="px-5 py-2.5 text-left">Date</th>
                    <th className="px-5 py-2.5 text-left">Party</th>
                    <th className="px-5 py-2.5 text-left">Mode</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.documents.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-text-2">No sales or purchase documents in this period</td></tr>
                  ) : r.documents.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2 text-text-2">{docUi(d.doc_type).label}</td>
                      <td className="px-5 py-2"><Link href={docPath(d.doc_type, d.id)} className="font-mono text-primary hover:underline">{d.invoice_number}</Link></td>
                      <td className="px-5 py-2 text-text-2">{shortDate(d.issue_date)}</td>
                      <td className="px-5 py-2 text-text-1">{d.party_name}</td>
                      <td className="px-5 py-2 text-text-2 capitalize">{d.payment_mode}</td>
                      <td className="px-5 py-2 text-right font-medium">{inr(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-text-2">
            Pending (unapproved) returns and cancelled documents are excluded. Margin uses each title&apos;s current purchase rate.{' '}
            <Link href="/sales" className="text-primary hover:underline">Paid-invoice collections view →</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function RankTable({ title, head, rows }: { title: string; head: [string, string, string]; rows: string[][] }) {
  return (
    <Card padding={false}>
      <div className="p-5 pb-3"><h3 className="text-base font-semibold text-text-1">{title}</h3></div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border text-xs font-medium text-text-2 uppercase tracking-wider">
            <th className="px-5 py-2 text-left">{head[0]}</th>
            <th className="px-5 py-2 text-right">{head[1]}</th>
            <th className="px-5 py-2 text-right">{head[2]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-5 py-8 text-center text-text-2">No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i}>
              <td className="px-5 py-2 text-text-1"><span className="block max-w-[200px] truncate">{row[0]}</span></td>
              <td className="px-5 py-2 text-right text-text-2">{row[1]}</td>
              <td className="px-5 py-2 text-right font-medium">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
