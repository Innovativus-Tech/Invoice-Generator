import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { organizationsService } from '../services/organizations.service.js';

export class OrganizationsController {
  async me(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await organizationsService.getCurrentOrg(req.org.id, req.org.role);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async members(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await organizationsService.getMembers(req.org.id);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async invitations(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await organizationsService.getPendingInvitations(req.org.id);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async invite(req: AuthenticatedRequest, res: Response) {
    try {
      const { email, role } = req.body;
      const data = await organizationsService.inviteMember({
        orgId: req.org.id,
        orgName: req.org.name,
        inviterId: req.userId,
        inviterRole: req.org.role,
        email,
        role,
      });
      res.status(201).json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(400).json({ data: null, error: { message: err.message, code: 'INVITE_ERROR' }, meta: null });
    }
  }

  async removeMember(req: AuthenticatedRequest<{ userId: string }>, res: Response) {
    try {
      const data = await organizationsService.removeMember(req.org.id, req.userId, req.params.userId);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(400).json({ data: null, error: { message: err.message, code: 'REMOVE_MEMBER_ERROR' }, meta: null });
    }
  }

  async changeRole(req: AuthenticatedRequest<{ userId: string }, any, { role: 'admin' | 'staff' }>, res: Response) {
    try {
      const data = await organizationsService.changeMemberRole(req.org.id, req.params.userId, req.body.role);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(400).json({ data: null, error: { message: err.message, code: 'CHANGE_ROLE_ERROR' }, meta: null });
    }
  }

  async revokeInvitation(req: AuthenticatedRequest<{ invitationId: string }>, res: Response) {
    try {
      const data = await organizationsService.revokeInvitation(req.org.id, req.params.invitationId);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(400).json({ data: null, error: { message: err.message, code: 'REVOKE_INVITATION_ERROR' }, meta: null });
    }
  }
}

export const organizationsController = new OrganizationsController();
