import { Router } from 'express';
import multer from 'multer';
import { settingsController } from '../controllers/settings.controller.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware as any);

router.get('/', (req: any, res) => {
  settingsController.get(req, res);
});

router.put('/', requirePermission('settings', 'update') as any, (req: any, res) => {
  settingsController.update(req, res);
});

router.post('/logo', requirePermission('settings', 'update') as any, upload.single('logo') as any, (req: any, res) => {
  settingsController.uploadLogo(req, res);
});

router.post('/signature', requirePermission('settings', 'update') as any, upload.single('signature') as any, (req: any, res) => {
  settingsController.uploadSignature(req, res);
});

export default router;
