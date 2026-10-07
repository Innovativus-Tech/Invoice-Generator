import { Router } from 'express';
import { documentHandlers } from '../controllers/document.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createDocumentSchema,
  deliveryUpdateSchema,
  documentQuerySchema,
  rejectSchema,
  statusUpdateSchema,
  updateDocumentSchema,
} from '../schemas/document.schema.js';

// Every trading document: sales invoices, estimates, challans, returns,
// credit/debit notes, purchase bills and binding orders. Permissions are
// checked per document type inside the handlers.
const router = Router();
const h = documentHandlers();

router.use(authMiddleware as any);

router.get('/', validate(documentQuerySchema, 'query') as any, h.list);
router.get('/next-number', h.nextNumber);
router.get('/:id', h.get);
router.post('/', validate(createDocumentSchema) as any, h.create);
router.put('/:id', validate(updateDocumentSchema) as any, h.update);
router.delete('/:id', h.remove);
router.patch('/:id/status', validate(statusUpdateSchema) as any, h.updateStatus);
router.post('/:id/approve', h.approve);
router.post('/:id/reject', validate(rejectSchema) as any, h.reject);
router.patch('/:id/delivery', validate(deliveryUpdateSchema) as any, h.updateDelivery);
router.get('/:id/download-pdf', h.downloadPdf);
router.post('/:id/generate-pdf', h.generatePdf);
router.post('/:id/send', h.send);

export default router;
