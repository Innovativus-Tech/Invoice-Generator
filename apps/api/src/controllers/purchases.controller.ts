import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { purchasesService } from '../services/purchases.service.js';
import { reportService } from '../services/report.service.js';
import { prisma } from '../lib/prisma.js';

export class PurchasesController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const data = await purchasesService.getOrders(req.org.id, month, year, page, limit);
      res.json({ data, error: null, meta: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages } });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const data = await purchasesService.getSummary(req.org.id, month, year);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getNextOrderId(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await purchasesService.getNextOrderId();
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await purchasesService.create(req.org.id, req.userId, req.body);
      res.status(201).json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async update(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const data = await purchasesService.update(req.org.id, req.params.id as string, req.body);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async delete(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      await purchasesService.delete(req.org.id, req.params.id as string);
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async exportPdf(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const year = parseInt(req.query.year as string) || now.getFullYear();

      const data = await purchasesService.getSummary(req.org.id, month, year);
      const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
      const p = org ? await prisma.profile.findUnique({ where: { id: org.ownerId }, select: { businessName: true, logoUrl: true, gstin: true } }) : null;
      const profile = p ? { business_name: p.businessName ?? undefined, logo_url: p.logoUrl ?? undefined, gstin: p.gstin ?? undefined } : {};

      const pdfBuffer = await reportService.generatePurchaseReport(data, profile, month, year);

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Purchase-Report-${monthNames[month-1]}-${year}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'PDF_ERROR' }, meta: null });
    }
  }
}

export const purchasesController = new PurchasesController();
