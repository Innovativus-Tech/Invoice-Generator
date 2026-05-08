import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, CacheKeys } from '../lib/cache.js';
import { notificationService } from './notifications.service.js';
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceQueryInput } from '../schemas/invoice.schema.js';

// Shape returned to callers — matches the old Supabase response structure
function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    taxRate: undefined,
    tax_rate: Number(invoice.taxRate ?? 0),
    taxAmount: undefined,
    tax_amount: Number(invoice.taxAmount ?? 0),
    discountAmount: undefined,
    discount_amount: Number(invoice.discountAmount ?? 0),
    total: Number(invoice.total),
    invoiceNumber: undefined,
    invoice_number: invoice.invoiceNumber,
    issueDate: undefined,
    issue_date: invoice.issueDate,
    clientId: undefined,
    client_id: invoice.clientId,
    orgId: undefined,
    org_id: invoice.orgId,
    userId: undefined,
    user_id: invoice.userId,
    pdfUrl: undefined,
    pdf_url: invoice.pdfUrl,
    sentAt: undefined,
    sent_at: invoice.sentAt,
    viewedAt: undefined,
    viewed_at: invoice.viewedAt,
    paidAt: undefined,
    paid_at: invoice.paidAt,
    createdAt: undefined,
    created_at: invoice.createdAt,
    updatedAt: undefined,
    updated_at: invoice.updatedAt,
    supplyType: undefined,
    supply_type: invoice.supplyType,
    billNumber: undefined,
    bill_number: invoice.billNumber,
    placeOfSupply: undefined,
    place_of_supply: invoice.placeOfSupply,
    orderId: undefined,
    order_id: invoice.orderId,
    orderDate: undefined,
    order_date: invoice.orderDate,
    // flatten client relation to match old `clients` key
    clients: invoice.client
      ? {
          name: invoice.client.name,
          email: invoice.client.email,
          company: invoice.client.company,
          address: invoice.client.address,
          phone: invoice.client.phone,
          gstin: invoice.client.gstin,
          state: invoice.client.state,
          state_code: invoice.client.stateCode,
        }
      : null,
    client: undefined,
    // flatten items
    items: (invoice.invoiceItems || []).map((item: any) => ({
      id: item.id,
      invoice_id: item.invoiceId,
      org_id: item.orgId,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice),
      amount: Number(item.amount),
      sort_order: item.sortOrder ?? 0,
      hsn_sac: item.hsnSac ?? '',
      gst_rate: Number(item.gstRate ?? 18),
      discount_percent: Number(item.discountPercent ?? 0),
    })),
    invoiceItems: undefined,
  };
}

export class InvoiceService {
  async getInvoices(orgId: string, query: InvoiceQueryInput) {
    const { status, client_id, from, to, page, limit, search, sort, order } = query;
    const offset = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      orgId,
      ...(status && { status }),
      ...(client_id && { clientId: client_id }),
      ...(from && { issueDate: { gte: new Date(from) } }),
      ...(to && { issueDate: { lte: new Date(to) } }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: { client: { select: { name: true, email: true, company: true } } },
        orderBy: { [sort === 'invoice_number' ? 'invoiceNumber' : sort === 'total' ? 'total' : 'createdAt']: order },
        skip: offset,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map((inv) => serializeInvoice({ ...inv, invoiceItems: [] })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInvoice(orgId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: {
        client: true,
        invoiceItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    return serializeInvoice(invoice);
  }

  private async invalidateInvoiceCaches(orgId: string) {
    await Promise.all([
      cacheDel(CacheKeys.dashboardStats(orgId), CacheKeys.clients(orgId), CacheKeys.nextInvoiceNumber(orgId)),
      cacheDelPattern(`dashboard:revenue:${orgId}:*`),
    ]);
  }

  async createInvoice(orgId: string, userId: string, input: CreateInvoiceInput) {
    const { items, ...invoiceData } = input;

    if (!items || items.length === 0) throw new Error('Invoice must have at least one item');
    const validItems = items.filter((item) => item.description);
    if (validItems.length === 0) throw new Error('No valid items to save');

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        orgId,
        invoiceNumber: invoiceData.invoice_number,
        status: invoiceData.status ?? 'draft',
        issueDate: new Date(invoiceData.issue_date),
        clientId: invoiceData.client_id ?? null,
        subtotal: invoiceData.subtotal,
        taxRate: invoiceData.tax_rate,
        taxAmount: invoiceData.tax_amount,
        discountAmount: invoiceData.discount_amount,
        total: invoiceData.total,
        currency: invoiceData.currency ?? 'INR',
        notes: invoiceData.notes ?? null,
        terms: invoiceData.terms ?? null,
        supplyType: invoiceData.supply_type ?? 'IGST',
        billNumber: invoiceData.bill_number ?? null,
        placeOfSupply: invoiceData.place_of_supply ?? null,
        orderId: invoiceData.order_id ?? null,
        orderDate: invoiceData.order_date ? new Date(invoiceData.order_date) : null,
        invoiceItems: {
          createMany: {
            data: validItems.map((item, index) => ({
              orgId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              amount: item.amount,
              sortOrder: item.sort_order ?? index,
              hsnSac: item.hsn_sac ?? '',
              gstRate: item.gst_rate ?? 18,
              discountPercent: item.discount_percent ?? 0,
            })),
          },
        },
      },
      include: {
        client: true,
        invoiceItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.incrementOrgInvoiceNumber(orgId).catch((e) => {
      console.warn('Failed to increment invoice number:', e.message);
    });
    await this.invalidateInvoiceCaches(orgId);

    return serializeInvoice(invoice);
  }

  async updateInvoice(orgId: string, invoiceId: string, input: UpdateInvoiceInput) {
    const { items, ...invoiceData } = input;

    const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
    if (!existing) throw new Error('Invoice not found');

    const updateData: Prisma.InvoiceUpdateInput = {};
    if (invoiceData.invoice_number !== undefined) updateData.invoiceNumber = invoiceData.invoice_number;
    if (invoiceData.status !== undefined) updateData.status = invoiceData.status;
    if (invoiceData.issue_date !== undefined) updateData.issueDate = new Date(invoiceData.issue_date);
    if (invoiceData.client_id !== undefined) updateData.client = invoiceData.client_id
      ? { connect: { id: invoiceData.client_id } }
      : { disconnect: true };
    if (invoiceData.subtotal !== undefined) updateData.subtotal = invoiceData.subtotal;
    if (invoiceData.tax_rate !== undefined) updateData.taxRate = invoiceData.tax_rate;
    if (invoiceData.tax_amount !== undefined) updateData.taxAmount = invoiceData.tax_amount;
    if (invoiceData.discount_amount !== undefined) updateData.discountAmount = invoiceData.discount_amount;
    if (invoiceData.total !== undefined) updateData.total = invoiceData.total;
    if (invoiceData.currency !== undefined) updateData.currency = invoiceData.currency;
    if (invoiceData.notes !== undefined) updateData.notes = invoiceData.notes;
    if (invoiceData.terms !== undefined) updateData.terms = invoiceData.terms;
    if (invoiceData.supply_type !== undefined) updateData.supplyType = invoiceData.supply_type;
    if (invoiceData.bill_number !== undefined) updateData.billNumber = invoiceData.bill_number;
    if (invoiceData.place_of_supply !== undefined) updateData.placeOfSupply = invoiceData.place_of_supply;
    if (invoiceData.order_id !== undefined) updateData.orderId = invoiceData.order_id;
    if (invoiceData.order_date !== undefined) {
      updateData.orderDate = invoiceData.order_date ? new Date(invoiceData.order_date) : null;
    }

    if (items !== undefined) {
      if (items.length === 0) throw new Error('Invoice must have at least one item');
      const validItems = items.filter((item) => item.description);
      if (validItems.length === 0) throw new Error('No valid items to save');

      await prisma.$transaction([
        prisma.invoiceItem.deleteMany({ where: { invoiceId, orgId } }),
        prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            ...updateData,
            invoiceItems: {
              createMany: {
                data: validItems.map((item, index) => ({
                  orgId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  amount: item.amount,
                  sortOrder: item.sort_order ?? index,
                  hsnSac: item.hsn_sac ?? '',
                  gstRate: item.gst_rate ?? 18,
                  discountPercent: item.discount_percent ?? 0,
                })),
              },
            },
          },
        }),
      ]);
    } else if (Object.keys(updateData).length > 0) {
      await prisma.invoice.update({ where: { id: invoiceId }, data: updateData });
    }

    await this.invalidateInvoiceCaches(orgId);
    return this.getInvoice(orgId, invoiceId);
  }

  async deleteInvoice(orgId: string, invoiceId: string) {
    await prisma.invoice.deleteMany({ where: { id: invoiceId, orgId } });
    await this.invalidateInvoiceCaches(orgId);
    return { success: true };
  }

  async updateStatus(orgId: string, userId: string, invoiceId: string, status: string) {
    const updateData: Prisma.InvoiceUpdateInput = { status };
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'paid') updateData.paidAt = new Date();
    if (status === 'viewed') updateData.viewedAt = new Date();

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    if (status === 'viewed' || status === 'paid') {
      const invoiceNumber = invoice.invoiceNumber || invoiceId;
      if (status === 'viewed') {
        notificationService
          .createIfEnabled(userId, 'invoice_viewed', 'Invoice viewed', `Client viewed invoice ${invoiceNumber}`, invoiceId, orgId)
          .catch((e) => console.warn('Notification error:', e));
      } else {
        notificationService
          .createIfEnabled(userId, 'payment_received', 'Payment received', `Payment received for invoice ${invoiceNumber}`, invoiceId, orgId)
          .catch((e) => console.warn('Notification error:', e));
      }
    }

    await this.invalidateInvoiceCaches(orgId);
    return serializeInvoice({ ...invoice, invoiceItems: [], client: null });
  }

  private async getOrgOwnerProfile(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    if (!org) return null;
    return prisma.profile.findUnique({
      where: { id: org.ownerId },
      select: { id: true, invoicePrefix: true, nextInvoiceNumber: true },
    });
  }

  private async incrementOrgInvoiceNumber(orgId: string) {
    const profile = await this.getOrgOwnerProfile(orgId);
    if (!profile) return;

    await prisma.profile.update({
      where: { id: profile.id },
      data: { nextInvoiceNumber: (profile.nextInvoiceNumber ?? 1001) + 1 },
    });
  }

  async getNextInvoiceNumber(orgId: string) {
    const key = CacheKeys.nextInvoiceNumber(orgId);
    const cached = await cacheGet<string>(key);
    if (cached) return cached;

    const profile = await this.getOrgOwnerProfile(orgId);
    const prefix = profile?.invoicePrefix || 'INV';
    const number = profile?.nextInvoiceNumber || 1001;
    const year = new Date().getFullYear();
    const result = `${prefix}-${year}-${number}`;
    await cacheSet(key, result, 60);
    return result;
  }

  async getDashboardStats(orgId: string) {
    const key = CacheKeys.dashboardStats(orgId);
    const cached = await cacheGet<object>(key);
    if (cached) return cached;

    const invoices = await prisma.invoice.findMany({
      where: { orgId },
      select: { status: true, total: true, paidAt: true, createdAt: true },
    });

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalRevenue = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.total), 0);

    const paidCount = invoices.filter((i) => i.status === 'paid').length;

    const pendingAmount = invoices
      .filter((i) => !['paid', 'cancelled'].includes(i.status))
      .reduce((sum, i) => sum + Number(i.total), 0);

    const thisMonthRevenue = invoices
      .filter((i) => i.status === 'paid' && i.paidAt && new Date(i.paidAt) >= thisMonth)
      .reduce((sum, i) => sum + Number(i.total), 0);

    const lastMonthRevenue = invoices
      .filter(
        (i) =>
          i.status === 'paid' &&
          i.paidAt &&
          new Date(i.paidAt) >= lastMonth &&
          new Date(i.paidAt) <= lastMonthEnd
      )
      .reduce((sum, i) => sum + Number(i.total), 0);

    const revenueTrend =
      lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;

    const stats = { totalRevenue, paidCount, pendingAmount, revenueTrend, thisMonthRevenue };
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
      where: { orgId, status: 'paid', paidAt: { gte: startDate } },
      select: { total: true, paidAt: true },
    });

    const chartData: { month: string; revenue: number }[] = [];

    if (period === '1y') {
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const label = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const revenue = invoices
          .filter((inv) => {
            const paidAt = new Date(inv.paidAt!);
            return paidAt >= date && paidAt <= monthEnd;
          })
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
          .filter((inv) => {
            const paidAt = new Date(inv.paidAt!);
            return paidAt >= dayStart && paidAt <= dayEnd;
          })
          .reduce((sum, inv) => sum + Number(inv.total), 0);
        chartData.push({ month: label, revenue });
      }
    }

    await cacheSet(key, chartData, 300);
    return chartData;
  }
}

export const invoiceService = new InvoiceService();
