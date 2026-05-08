import { Router } from 'express';
import { notificationController } from '../controllers/notifications.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require auth
router.use(authMiddleware as any);

// GET /api/notifications — list recent notifications
router.get('/', (req: any, res) => {
  notificationController.list(req, res);
});

// GET /api/notifications/unread-count — get unread count
router.get('/unread-count', (req: any, res) => {
  notificationController.getUnreadCount(req, res);
});

// GET /api/notifications/preferences — get preferences
router.get('/preferences', (req: any, res) => {
  notificationController.getPreferences(req, res);
});

// PUT /api/notifications/preferences — update preferences
router.put('/preferences', (req: any, res) => {
  notificationController.updatePreferences(req, res);
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', (req: any, res) => {
  notificationController.markAllRead(req, res);
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', (req: any, res) => {
  notificationController.markRead(req, res);
});

export default router;
