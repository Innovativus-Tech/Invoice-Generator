'use client';

import { useAuth } from '@/hooks/use-auth';

type Role = 'owner' | 'admin' | 'staff';

// Mirrors apps/api/src/middleware/rbac.middleware.ts. `invoices` covers every
// sales document; `purchases` covers purchase bills, returns, debit notes and
// binding orders.
const PERMISSIONS: Record<Role, Record<string, string[]>> = {
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

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || 'staff';

  return {
    can: (resource: string, action: string): boolean => {
      return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
    },
    role,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
  };
}
