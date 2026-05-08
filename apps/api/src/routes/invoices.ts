import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateStatusSchema,
  invoiceQuerySchema,
} from '../schemas/invoice.schema.js';

const router = Router();

// All routes require auth
router.use(authMiddleware as any);

// GET /api/invoices — list with filters
router.get('/', validate(invoiceQuerySchema, 'query') as any, (req: any, res) => {
  invoiceController.list(req, res);
});

// GET /api/invoices/next-number — get next invoice number
router.get('/next-number', (req: any, res) => {
  invoiceController.getNextNumber(req, res);
});

// GET /api/invoices/:id — get single invoice
router.get('/:id', (req: any, res) => {
  invoiceController.get(req, res);
});

// POST /api/invoices — create invoice
router.post('/', requirePermission('invoices', 'create') as any, validate(createInvoiceSchema) as any, (req: any, res) => {
  invoiceController.create(req, res);
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', requirePermission('invoices', 'update') as any, validate(updateInvoiceSchema) as any, (req: any, res) => {
  invoiceController.update(req, res);
});

// DELETE /api/invoices/:id — delete invoice
router.delete('/:id', requirePermission('invoices', 'delete') as any, (req: any, res) => {
  invoiceController.delete(req, res);
});

// POST /api/invoices/:id/send — send invoice via email
router.post('/:id/send', requirePermission('invoices', 'send') as any, (req: any, res) => {
  invoiceController.send(req, res);
});

// POST /api/invoices/:id/generate-pdf — generate PDF
router.post('/:id/generate-pdf', (req: any, res) => {
  invoiceController.generatePdf(req, res);
});

// PATCH /api/invoices/:id/status — update status
router.patch('/:id/status', requirePermission('invoices', 'update') as any, validate(updateStatusSchema) as any, (req: any, res) => {
  invoiceController.updateStatus(req, res);
});

export default router;
