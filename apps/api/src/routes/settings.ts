import { Router } from 'express';
import multer from 'multer';
import { settingsController } from '../controllers/settings.controller.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { route } from '../lib/http.js';
import { bindingRatesService } from '../services/binding-rates.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware as any);

router.get('/', (req: any, res) => {
  settingsController.get(req, res);
});

router.put('/', requirePermission('settings', 'update') as any, (req: any, res) => {
  settingsController.update(req, res);
});

// Separate number series per document type (estimate numbers ≠ sales bill numbers).
router.get('/numbering', settingsController.numbering);
router.put('/numbering', requirePermission('settings', 'update') as any, settingsController.updateNumbering);

// Binding rate card (charge per copy by binding type) used on purchase bills.
router.get('/binding-rates', route((req) => bindingRatesService.list(req.org.id)));
router.put('/binding-rates', requirePermission('purchases', 'update') as any,
  route((req) => bindingRatesService.replace(req.org.id, Array.isArray(req.body?.rates) ? req.body.rates : [])));

router.post('/logo', requirePermission('settings', 'update') as any, upload.single('logo') as any, (req: any, res) => {
  settingsController.uploadLogo(req, res);
});

router.post('/signature', requirePermission('settings', 'update') as any, upload.single('signature') as any, (req: any, res) => {
  settingsController.uploadSignature(req, res);
});

export default router;
