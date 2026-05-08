import { prisma } from '../lib/prisma.js';

export class SalesService {
  async getSummary(orgId: string, month: number, year: number) {
    const allPaid = await prisma.invoice.findMany({
      where: { orgId, status: 'paid' },
      include: { client: { select: { id: true, name: true, email: true, company: true } } },
    });

    const filtered = allPaid.filter((inv) => {
      const d = new Date((inv.paidAt || inv.issueDate) as Date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const total_revenue = filtered.reduce((s, i) => s + Number(i.total), 0);
    const invoice_count = filtered.length;
    const average_invoice_value = invoice_count > 0 ? total_revenue / invoice_count : 0;

    const clientMap = new Map<string, { client_name: string; client_id: string; total: number; invoice_count: number }>();
    for (const inv of filtered) {
      const name = inv.client?.name || 'Unknown';
      const cid = inv.clientId || '';
      const key = cid || name;
      const existing = clientMap.get(key) || { client_name: name, client_id: cid, total: 0, invoice_count: 0 };
      existing.total += Number(inv.total);
      existing.invoice_count += 1;
      clientMap.set(key, existing);
    }
    const top_clients = Array.from(clientMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const monthly_breakdown = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthInvoices = allPaid.filter((inv) => {
        const pd = new Date((inv.paidAt || inv.issueDate) as Date);
        return pd.getMonth() === m && pd.getFullYear() === y;
      });
      monthly_breakdown.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        amount: monthInvoices.reduce((s, i) => s + Number(i.total), 0),
        count: monthInvoices.length,
      });
    }

    return {
      total_revenue,
      invoice_count,
      average_invoice_value,
      top_clients,
      monthly_breakdown,
      invoices: filtered.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        client_id: inv.clientId,
        total: Number(inv.total),
        paid_at: inv.paidAt,
        issue_date: inv.issueDate,
        clients: inv.client
          ? { name: inv.client.name, email: inv.client.email, company: inv.client.company }
          : null,
      })),
    };
  }
}

export const salesService = new SalesService();
