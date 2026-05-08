import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { salesService } from '../services/sales.service.js';
import { reportService } from '../services/report.service.js';
import { prisma } from '../lib/prisma.js';

export class SalesController {
  async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const data = await salesService.getSummary(req.org.id, month, year);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async exportPdf(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const year = parseInt(req.query.year as string) || now.getFullYear();

      const data = await salesService.getSummary(req.org.id, month, year);
      const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
      const p = org ? await prisma.profile.findUnique({ where: { id: org.ownerId }, select: { businessName: true, logoUrl: true, gstin: true } }) : null;
      const profile = p ? { business_name: p.businessName ?? undefined, logo_url: p.logoUrl ?? undefined, gstin: p.gstin ?? undefined } : {};

      const pdfBuffer = await reportService.generateSalesReport(data, profile, month, year);

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Sales-Report-${monthNames[month-1]}-${year}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'PDF_ERROR' }, meta: null });
    }
  }
}

export const salesController = new SalesController();
