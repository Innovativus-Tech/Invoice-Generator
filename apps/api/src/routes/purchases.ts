import { Router } from 'express';
import { purchasesController } from '../controllers/purchases.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();
router.use(authMiddleware as any);

router.get('/summary', (req: any, res) => {
  purchasesController.getSummary(req, res);
});

router.get('/next-order-id', (req: any, res) => {
  purchasesController.getNextOrderId(req, res);
});

router.get('/export-pdf', (req: any, res) => {
  purchasesController.exportPdf(req, res);
});

router.get('/', (req: any, res) => {
  purchasesController.list(req, res);
});

router.post('/', requirePermission('purchases', 'create') as any, (req: any, res) => {
  purchasesController.create(req, res);
});

router.put('/:id', requirePermission('purchases', 'update') as any, (req: any, res) => {
  purchasesController.update(req, res);
});

router.delete('/:id', requirePermission('purchases', 'delete') as any, (req: any, res) => {
  purchasesController.delete(req, res);
});

export default router;
