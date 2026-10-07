import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { route } from '../lib/http.js';
import { invoiceService } from '../services/invoice.service.js';
import { analyticsService } from '../services/analytics.service.js';

const router = Router();
router.use(authMiddleware as any);

router.get('/stats', requirePermission('sales', 'read') as any, route(async (req) => {
  const stats = await invoiceService.getDashboardStats(req.org.id);
  // Create overdue notifications in the background.
  invoiceService.checkOverdue(req.org.id, req.userId).catch(() => {});
  return stats;
}));

router.get('/revenue', requirePermission('sales', 'read') as any, route((req) =>
  invoiceService.getRevenueChart(req.org.id, (req.query.period as string) || '30d')
));

// Everything the business dashboard shows, in one round trip.
router.get('/overview', requirePermission('reports', 'read') as any, route(async (req) => {
  invoiceService.checkOverdue(req.org.id, req.userId).catch(() => {});
  return analyticsService.overview(req.org.id);
}));

export default router;
