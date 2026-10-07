import { Router } from 'express';
import { clientController } from '../controllers/client.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema.js';

// Parties: customers, suppliers and binders.
const router = Router();

router.use(authMiddleware as any);

router.get('/', clientController.list);
router.get('/:id', clientController.get);
router.get('/:id/ledger', clientController.ledger);
router.post('/', requirePermission('clients', 'create') as any, validate(createClientSchema) as any, clientController.create);
router.put('/:id', requirePermission('clients', 'update') as any, validate(updateClientSchema) as any, clientController.update);
router.delete('/:id', requirePermission('clients', 'delete') as any, clientController.delete);

export default router;
