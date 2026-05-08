import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { notificationService } from '../services/notifications.service.js';

export class NotificationController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await notificationService.getNotifications(req.org.id);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async markRead(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      await notificationService.markRead(req.org.id, req.params.id as string);
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async markAllRead(req: AuthenticatedRequest, res: Response) {
    try {
      await notificationService.markAllRead(req.org.id);
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await notificationService.getUnreadCount(req.org.id);
      res.json({ data: result, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getPreferences(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await notificationService.getPreferences(req.userId);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response) {
    try {
      const { invoice_viewed, payment_received, invoice_overdue } = req.body;
      const data = await notificationService.updatePreferences(req.userId, {
        invoice_viewed: invoice_viewed ?? true,
        payment_received: payment_received ?? true,
        invoice_overdue: invoice_overdue ?? true,
      });
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }
}

export const notificationController = new NotificationController();
