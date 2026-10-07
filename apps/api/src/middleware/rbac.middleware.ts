import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';

type Role = 'owner' | 'admin' | 'staff';
type PermissionMap = Record<Role, Record<string, string[]>>;

// `invoices` guards every sales document (invoice, estimate, challan, sales
// return, credit note); `purchases` guards purchase documents (purchase bill,
// purchase return, debit note, binding order) and quick purchases.
// Keep in sync with apps/web/hooks/use-permissions.ts.
export const PERMISSIONS: PermissionMap = {
  owner: {
    invoices: ['create', 'read', 'update', 'delete', 'send'],
    clients: ['create', 'read', 'update', 'delete'],
    inventory: ['create', 'read', 'update', 'delete'],
    purchases: ['create', 'read', 'update', 'delete', 'send'],
    payments: ['create', 'read', 'update', 'delete'],
    approvals: ['approve'],
    reports: ['read'],
    sales: ['read'],
    settings: ['read', 'update'],
    team: ['invite', 'remove', 'change_role'],
  },
  admin: {
    invoices: ['create', 'read', 'update', 'delete', 'send'],
    clients: ['create', 'read', 'update', 'delete'],
    inventory: ['create', 'read', 'update', 'delete'],
    purchases: ['create', 'read', 'update', 'delete', 'send'],
    payments: ['create', 'read', 'update', 'delete'],
    approvals: ['approve'],
    reports: ['read'],
    sales: ['read'],
    settings: ['read', 'update'],
    team: ['invite'],
  },
  staff: {
    invoices: ['create', 'read', 'update', 'send'],
    clients: ['create', 'read', 'update'],
    inventory: ['read'],
    purchases: ['create', 'read'],
    payments: ['create', 'read'],
    approvals: [],
    reports: ['read'],
    sales: ['read'],
    settings: ['read'],
    team: [],
  },
};

export function requirePermission(resource: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.org?.role;
    const allowed = role ? PERMISSIONS[role]?.[resource] || [] : [];

    if (!role || !allowed.includes(action)) {
      res.status(403).json({
        data: null,
        error: {
          message: `Permission denied. Role '${role || 'unknown'}' cannot '${action}' ${resource}.`,
          code: 'PERMISSION_DENIED',
        },
        meta: null,
      });
      return;
    }

    next();
  };
}
