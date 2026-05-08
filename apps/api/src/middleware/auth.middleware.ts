import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  userId: string;
  userEmail: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
  org: {
    id: string;
    name: string;
    role: 'owner' | 'admin' | 'staff';
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        data: null,
        error: { message: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' },
        meta: null,
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT — must use auth client (not Prisma, which has no auth table)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        data: null,
        error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
        meta: null,
      });
      return;
    }

    // BUG 7 FIX: Use Prisma for membership lookup — bypasses RLS entirely
    // (Prisma connects directly with DATABASE_URL, ignoring Supabase RLS)
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!membership) {
      res.status(403).json({
        data: null,
        error: { message: 'No organization membership found', code: 'NO_ORGANIZATION' },
        meta: null,
      });
      return;
    }

    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).userEmail = user.email || '';
    (req as AuthenticatedRequest).accessToken = token;
    (req as AuthenticatedRequest).user = { id: user.id, email: user.email || '' };
    (req as AuthenticatedRequest).org = {
      id: membership.orgId,
      name: membership.organization?.name || 'Organization',
      role: membership.role as 'owner' | 'admin' | 'staff',
    };

    next();
  } catch (err) {
    res.status(500).json({
      data: null,
      error: { message: 'Authentication failed', code: 'AUTH_ERROR' },
      meta: null,
    });
  }
}
