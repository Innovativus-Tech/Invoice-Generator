import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, CacheKeys } from '../lib/cache.js';
import { notificationService } from './notifications.service.js';

// Sales-invoice dashboard metrics. Document CRUD for every type, including
// sales invoices, lives in document.service.ts.

const SALES = 'sales_invoice';

export class InvoiceService {
  async getDashboardStats(orgId: string) {
    const key = CacheKeys.dashboardStats(orgId);
    const cached = await cacheGet<object>(key);
    if (cached) return cached;

    const invoices = await prisma.invoice.findMany({
      where: { orgId, docType: SALES, status: { not: 'cancelled' } },
      select: { status: true, total: true, amountPaid: true, paidAt: true },
    });

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const paid = invoices.filter((i) => i.status === 'paid');
    const totalRevenue = paid.reduce((sum, i) => sum + Number(i.total), 0);
    const pendingAmount = invoices
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + Math.max(Number(i.total) - Number(i.amountPaid), 0), 0);
    const inRange = (d: Date | null, from: Date, to?: Date) => !!d && d >= from && (!to || d <= to);
    const thisMonthRevenue = paid.filter((i) => inRange(i.paidAt, thisMonth)).reduce((s, i) => s + Number(i.total), 0);
    const lastMonthRevenue = paid.filter((i) => inRange(i.paidAt, lastMonth, lastMonthEnd)).reduce((s, i) => s + Number(i.total), 0);
    const revenueTrend = lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;

    const stats = { totalRevenue, paidCount: paid.length, pendingAmount, revenueTrend, thisMonthRevenue };
    await cacheSet(key, stats, 120);
    return stats;
  }

  async checkOverdue(orgId: string, userId: string) {
    try {
      await notificationService.checkOverdueInvoices(userId, orgId);
    } catch (e) {
      console.warn('Overdue check error:', e);
    }
  }

  async getRevenueChart(orgId: string, period: string = '30d') {
    const key = CacheKeys.revenueChart(orgId, period);
    const cached = await cacheGet<{ month: string; revenue: number }[]>(key);
    if (cached) return cached;
    const now = new Date();
    let startDate: Date;

    if (period === '7d') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '1y') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    }

    const invoices = await prisma.invoice.findMany({
      where: { orgId, docType: SALES, status: 'paid', paidAt: { gte: startDate } },
      select: { total: true, paidAt: true },
    });

    const chartData: { month: string; revenue: number }[] = [];

    if (period === '1y') {
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        const label = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const revenue = invoices
          .filter((inv) => inv.paidAt! >= date && inv.paidAt! <= monthEnd)
          .reduce((sum, inv) => sum + Number(inv.total), 0);
        chartData.push({ month: label, revenue });
      }
    } else {
      const days = period === '7d' ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
        const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const revenue = invoices
          .filter((inv) => inv.paidAt! >= dayStart && inv.paidAt! <= dayEnd)
          .reduce((sum, inv) => sum + Number(inv.total), 0);
        chartData.push({ month: label, revenue });
      }
    }

    await cacheSet(key, chartData, 300);
    return chartData;
  }
}

export const invoiceService = new InvoiceService();
