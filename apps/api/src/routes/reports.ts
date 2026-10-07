import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { pdfFileName, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { analyticsService } from '../services/analytics.service.js';
import { ledgerService } from '../services/ledger.service.js';
import { reportService } from '../services/report.service.js';
import { todayISO } from '../lib/dates.js';

const periodQuery = z.object({
  period: z.enum(['month', 'year', 'fy']).default('month'),
  year: z.coerce.number().int().min(2000).max(2100).default(() => Number(todayISO().slice(0, 4))),
  month: z.coerce.number().int().min(1).max(12).default(() => Number(todayISO().slice(5, 7))),
});

const outstandingQuery = z.object({
  side: z.enum(['receivable', 'payable']).default('receivable'),
  client_id: z.string().uuid().optional(),
});

const router = Router();
router.use(authMiddleware as any);

// Sales & purchase summary for a month, calendar year or financial year (Apr–Mar).
router.get('/summary', requirePermission('reports', 'read') as any, validate(periodQuery, 'query') as any,
  route((req) => {
    const q = req.query as unknown as z.infer<typeof periodQuery>;
    return analyticsService.report(req.org.id, q.period, q.year, q.month);
  }));

router.get('/export-pdf', requirePermission('reports', 'read') as any, validate(periodQuery, 'query') as any,
  route(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof periodQuery>;
    const data = await analyticsService.report(req.org.id, q.period, q.year, q.month);
    const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
    const p = org ? await prisma.profile.findUnique({ where: { id: org.ownerId }, select: { businessName: true, logoUrl: true, gstin: true } }) : null;
    const pdf = await reportService.generatePeriodReport(data, {
      business_name: p?.businessName ?? undefined,
      logo_url: p?.logoUrl ?? undefined,
      gstin: p?.gstin ?? undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName('Sales-Purchase-Report', data.label)}"`);
    res.send(pdf);
  }, { errorCode: 'PDF_ERROR' }));

// Bill-wise outstanding with due dates and days overdue.
router.get('/outstanding', requirePermission('reports', 'read') as any, validate(outstandingQuery, 'query') as any,
  route((req) => {
    const q = req.query as unknown as z.infer<typeof outstandingQuery>;
    return ledgerService.getOutstanding(req.org.id, q.side, q.client_id);
  }));

export default router;
