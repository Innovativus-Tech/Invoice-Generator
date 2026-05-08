import { prisma } from '../lib/prisma.js';

export class NotificationService {
  async getNotifications(orgId: string) {
    const notifications = await prisma.notification.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return notifications.map(serializeNotification);
  }

  async markRead(orgId: string, notificationId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, orgId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAllRead(orgId: string) {
    await prisma.notification.updateMany({
      where: { orgId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async getUnreadCount(orgId: string) {
    const count = await prisma.notification.count({
      where: { orgId, isRead: false },
    });
    return { count };
  }

  async getPreferences(userId: string) {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    return prefs
      ? {
          user_id: prefs.userId,
          invoice_viewed: prefs.invoiceViewed ?? true,
          payment_received: prefs.paymentReceived ?? true,
          invoice_overdue: prefs.invoiceOverdue ?? true,
        }
      : {
          user_id: userId,
          invoice_viewed: true,
          payment_received: true,
          invoice_overdue: true,
        };
  }

  async updatePreferences(
    userId: string,
    prefs: { invoice_viewed: boolean; payment_received: boolean; invoice_overdue: boolean }
  ) {
    const result = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        invoiceViewed: prefs.invoice_viewed,
        paymentReceived: prefs.payment_received,
        invoiceOverdue: prefs.invoice_overdue,
        updatedAt: new Date(),
      },
      create: {
        userId,
        invoiceViewed: prefs.invoice_viewed,
        paymentReceived: prefs.payment_received,
        invoiceOverdue: prefs.invoice_overdue,
      },
    });

    return {
      user_id: result.userId,
      invoice_viewed: result.invoiceViewed,
      payment_received: result.paymentReceived,
      invoice_overdue: result.invoiceOverdue,
    };
  }

  async createIfEnabled(
    userId: string,
    type: 'invoice_viewed' | 'payment_received' | 'invoice_overdue',
    title: string,
    message: string,
    invoiceId: string,
    orgId: string
  ) {
    const prefs = await this.getPreferences(userId);
    const prefKey: Record<string, keyof typeof prefs> = {
      invoice_viewed: 'invoice_viewed',
      payment_received: 'payment_received',
      invoice_overdue: 'invoice_overdue',
    };

    if (prefs[prefKey[type]] === false) return;

    await prisma.notification.create({
      data: {
        userId,
        orgId,
        type,
        title,
        message,
        invoiceId,
      },
    }).catch((e) => console.warn('Failed to create notification:', e.message));
  }

  async checkOverdueInvoices(userId: string, orgId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoices = await prisma.invoice.findMany({
      where: {
        orgId,
        status: 'sent',
        sentAt: { lt: thirtyDaysAgo },
      },
      select: { id: true, invoiceNumber: true },
    });

    if (invoices.length === 0) return;

    for (const inv of invoices) {
      const existing = await prisma.notification.findFirst({
        where: { orgId, type: 'invoice_overdue', invoiceId: inv.id },
        select: { id: true },
      });

      if (existing) continue;

      await this.createIfEnabled(
        userId,
        'invoice_overdue',
        'Invoice overdue',
        `Invoice ${inv.invoiceNumber} is overdue`,
        inv.id,
        orgId
      );
    }
  }
}

function serializeNotification(n: any) {
  return {
    id: n.id,
    user_id: n.userId,
    org_id: n.orgId,
    type: n.type,
    title: n.title,
    message: n.message,
    invoice_id: n.invoiceId,
    is_read: n.isRead,
    created_at: n.createdAt,
  };
}

export const notificationService = new NotificationService();
