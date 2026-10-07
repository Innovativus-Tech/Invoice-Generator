import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { route } from '../lib/http.js';
import { paymentService } from '../services/payment.service.js';
import { createPaymentSchema, paymentQuerySchema, updatePaymentSchema } from '../schemas/payment.schema.js';
import type { CreatePaymentInput, PaymentQuery, UpdatePaymentInput } from '../schemas/payment.schema.js';

// Receipts from customers ("in") and payments to suppliers / binders ("out").
const router = Router();
router.use(authMiddleware as any);

router.get('/', requirePermission('payments', 'read') as any, validate(paymentQuerySchema, 'query') as any,
  route((req) => paymentService.list(req.org.id, req.query as unknown as PaymentQuery)));

router.get('/:id', requirePermission('payments', 'read') as any,
  route((req) => paymentService.get(req.org.id, req.params.id)));

router.post('/', requirePermission('payments', 'create') as any, validate(createPaymentSchema) as any,
  route((req) => paymentService.create(req.org.id, req.userId, req.body as CreatePaymentInput), { status: 201 }));

router.put('/:id', requirePermission('payments', 'update') as any, validate(updatePaymentSchema) as any,
  route((req) => paymentService.update(req.org.id, req.params.id, req.body as UpdatePaymentInput)));

router.delete('/:id', requirePermission('payments', 'delete') as any,
  route((req) => paymentService.delete(req.org.id, req.params.id)));

export default router;
