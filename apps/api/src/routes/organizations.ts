import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { organizationsController } from '../controllers/organizations.controller.js';

const router = Router();

router.use(authMiddleware as any);

router.get('/me', (req: any, res) => {
  organizationsController.me(req, res);
});

router.get('/members', (req: any, res) => {
  organizationsController.members(req, res);
});

router.get('/invitations', requirePermission('team', 'invite') as any, (req: any, res) => {
  organizationsController.invitations(req, res);
});

router.post('/invite', requirePermission('team', 'invite') as any, (req: any, res) => {
  organizationsController.invite(req, res);
});

router.delete('/invitations/:invitationId', requirePermission('team', 'invite') as any, (req: any, res) => {
  organizationsController.revokeInvitation(req, res);
});

router.delete('/members/:userId', requirePermission('team', 'remove') as any, (req: any, res) => {
  organizationsController.removeMember(req, res);
});

router.patch('/members/:userId/role', requirePermission('team', 'change_role') as any, (req: any, res) => {
  organizationsController.changeRole(req, res);
});

export default router;
