import { Router } from 'express';
import { clientController } from '../controllers/client.controller.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema.js';

const router = Router();

router.use(authMiddleware as any);

router.get('/', (req: any, res) => {
  clientController.list(req, res);
});

router.get('/:id', (req: any, res) => {
  clientController.get(req, res);
});

router.post('/', requirePermission('clients', 'create') as any, validate(createClientSchema) as any, (req: any, res) => {
  clientController.create(req, res);
});

router.put('/:id', requirePermission('clients', 'update') as any, validate(updateClientSchema) as any, (req: any, res) => {
  clientController.update(req, res);
});

router.delete('/:id', requirePermission('clients', 'delete') as any, (req: any, res) => {
  clientController.delete(req, res);
});

export default router;
