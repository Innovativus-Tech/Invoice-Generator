import { Router } from 'express';
import { salesController } from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();
router.use(authMiddleware as any);

router.get('/summary', requirePermission('sales', 'read') as any, (req: any, res) => {
  salesController.getSummary(req, res);
});

router.get('/export-pdf', requirePermission('sales', 'read') as any, (req: any, res) => {
  salesController.exportPdf(req, res);
});

export default router;
