import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { route } from '../lib/http.js';
import { stockService } from '../services/stock.service.js';
import { optDate, pageQuery } from '../schemas/common.js';

const summaryQuery = z.object({
  search: z.string().trim().max(100).optional(),
  binding: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'low', 'out', 'attention', 'damaged', 'in_stock']).default('all'),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const movementQuery = z.object({
  item_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const adjustSchema = z
  .object({
    qty_change: z.coerce.number().int().min(-1_000_000).max(1_000_000).default(0),
    damaged_change: z.coerce.number().int().min(-1_000_000).max(1_000_000).default(0),
    reason: z.string().trim().min(1, 'Give a reason for the adjustment').max(300),
    date: optDate,
  })
  .refine((a) => a.qty_change !== 0 || a.damaged_change !== 0, { message: 'Enter a quantity to adjust', path: ['qty_change'] });

const router = Router();
router.use(authMiddleware as any);

// In-stock overview: quantities, damaged copies, reorder alerts and stock value.
router.get('/', requirePermission('inventory', 'read') as any, validate(summaryQuery, 'query') as any,
  route((req) => stockService.summary(req.org.id, req.query as any)));

// Stock ledger: every movement with the document that caused it.
router.get('/movements', requirePermission('inventory', 'read') as any, validate(movementQuery, 'query') as any,
  route((req) => stockService.listMovements(req.org.id, req.query as any)));

router.get('/:itemId', requirePermission('inventory', 'read') as any,
  route((req) => stockService.getItemStock(req.org.id, req.params.itemId)));

// Manual adjustment — stock count corrections, damage write-offs, etc.
router.post('/:itemId/adjust', requirePermission('inventory', 'update') as any, validate(adjustSchema) as any,
  route((req) => stockService.adjust(req.org.id, req.userId, req.params.itemId, req.body)));

export default router;
