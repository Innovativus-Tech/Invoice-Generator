import { prisma } from '../lib/prisma.js';

export class PurchasesService {
  async getOrders(orgId: string, month?: number, year?: number, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const where: any = { orgId };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.purchaseDate = { gte: start, lte: end };
    }

    const [orders, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { purchaseDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      orders: orders.map(serializeOrder),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(orgId: string, month: number, year: number) {
    const allOrders = await prisma.purchaseOrder.findMany({ where: { orgId } });

    const filtered = allOrders.filter((o) => {
      const d = new Date(o.purchaseDate);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const total_spent = filtered.reduce((s, o) => s + Number(o.totalAmount), 0);
    const order_count = filtered.length;
    const average_order_value = order_count > 0 ? total_spent / order_count : 0;

    const vendorMap = new Map<string, { client_name: string; total: number; order_count: number }>();
    for (const o of filtered) {
      const name = o.clientName || 'Unknown';
      const existing = vendorMap.get(name) || { client_name: name, total: 0, order_count: 0 };
      existing.total += Number(o.totalAmount);
      existing.order_count += 1;
      vendorMap.set(name, existing);
    }
    const top_vendors = Array.from(vendorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const monthly_breakdown = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthOrders = allOrders.filter((o) => {
        const pd = new Date(o.purchaseDate);
        return pd.getMonth() === m && pd.getFullYear() === y;
      });
      monthly_breakdown.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        amount: monthOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
        count: monthOrders.length,
      });
    }

    return {
      total_spent,
      order_count,
      average_order_value,
      top_vendors,
      monthly_breakdown,
      orders: filtered.map(serializeOrder),
    };
  }

  async create(
    orgId: string,
    userId: string,
    input: {
      client_id?: string;
      client_name: string;
      item_name: string;
      quantity: number;
      unit_price: number;
      purchase_date: string;
      notes?: string;
      status?: string;
    }
  ) {
    const totalAmount = input.quantity * input.unit_price;
    const year = new Date().getFullYear();
    const orderId = `PO-${year}-${Math.floor(Math.random() * 900000 + 100000)}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        userId,
        orgId,
        orderId,
        clientId: input.client_id || null,
        clientName: input.client_name,
        itemName: input.item_name,
        quantity: input.quantity,
        unitPrice: input.unit_price,
        totalAmount,
        purchaseDate: new Date(input.purchase_date),
        notes: input.notes || null,
        status: input.status || 'completed',
      },
    });

    return serializeOrder(order);
  }

  async update(orgId: string, id: string, input: Record<string, unknown>) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, orgId },
      select: { quantity: true, unitPrice: true },
    });
    if (!existing) throw new Error('Order not found');

    const qty = Number(input.quantity ?? existing.quantity);
    const price = Number(input.unit_price ?? existing.unitPrice);
    const totalAmount = qty * price;

    const updateData: any = { totalAmount };
    if (input.client_id !== undefined) updateData.clientId = input.client_id;
    if (input.client_name !== undefined) updateData.clientName = input.client_name;
    if (input.item_name !== undefined) updateData.itemName = input.item_name;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.unit_price !== undefined) updateData.unitPrice = input.unit_price;
    if (input.purchase_date !== undefined) updateData.purchaseDate = new Date(input.purchase_date as string);
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;

    const order = await prisma.purchaseOrder.update({ where: { id }, data: updateData });
    return serializeOrder(order);
  }

  async delete(orgId: string, id: string) {
    await prisma.purchaseOrder.deleteMany({ where: { id, orgId } });
    return { success: true };
  }

  async getNextOrderId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900000 + 100000);
    return { order_id: `PO-${year}-${random}` };
  }
}

function serializeOrder(o: any) {
  return {
    id: o.id,
    user_id: o.userId,
    org_id: o.orgId,
    order_id: o.orderId,
    client_id: o.clientId,
    client_name: o.clientName,
    item_name: o.itemName,
    quantity: Number(o.quantity),
    unit_price: Number(o.unitPrice),
    total_amount: Number(o.totalAmount),
    purchase_date: o.purchaseDate,
    notes: o.notes,
    status: o.status,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

export const purchasesService = new PurchasesService();
