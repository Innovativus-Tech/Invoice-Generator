import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { organizationsService } from '../services/organizations.service.js';

const router = Router();

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';
}

async function createUniqueSlug(orgName: string) {
  const base = slugify(orgName);
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${base}-${suffix}`;
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function createOrgOwner({
  orgName,
  email,
  password,
  fullName,
}: {
  orgName: string;
  email: string;
  password: string;
  fullName: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Unable to create user');

  const slug = await createUniqueSlug(orgName);
  const org = await prisma.organization.create({
    data: { name: orgName, slug, ownerId: authData.user.id },
    select: { id: true, name: true, slug: true },
  });

  await prisma.organizationMember.create({
    data: { orgId: org.id, userId: authData.user.id, role: 'owner', status: 'active' },
  });

  await prisma.profile.upsert({
    where: { id: authData.user.id },
    update: {},
    create: { id: authData.user.id, orgId: org.id, businessName: orgName, businessEmail: normalizedEmail },
  });

  const session = await signIn(normalizedEmail, password);
  return {
    user: authData.user,
    org: { ...org, role: 'owner' },
    token: session.session?.access_token,
    session: session.session,
  };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) {
      res.status(400).json({
        data: null,
        error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const data = await createOrgOwner({
      orgName: `${email.split('@')[0] || 'My'} Organization`,
      email,
      password,
      fullName: full_name || email.split('@')[0] || 'Owner',
    });

    res.status(201).json({ data, error: null, meta: null });
  } catch (err: any) {
    res.status(400).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

// POST /api/auth/register-org
router.post('/register-org', async (req: Request, res: Response) => {
  try {
    const { org_name, email, password, full_name } = req.body;
    if (!org_name || !email || !password || !full_name) {
      res.status(400).json({
        data: null,
        error: { message: 'Organization name, full name, email, and password are required', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const data = await createOrgOwner({ orgName: org_name, email, password, fullName: full_name });
    res.status(201).json({ data, error: null, meta: null });
  } catch (err: any) {
    res.status(400).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

// GET /api/auth/invitation/:token
router.get('/invitation/:token', async (req: Request<{ token: string }>, res: Response) => {
  try {
    const invitation = await organizationsService.getInvitationByToken(req.params.token);
    const isExpired = new Date(invitation.expires_at) < new Date();
    if (invitation.status !== 'pending' || isExpired) {
      res.status(400).json({
        data: null,
        error: { message: 'Invitation is no longer valid', code: 'INVALID_INVITATION' },
        meta: null,
      });
      return;
    }

    res.json({ data: invitation, error: null, meta: null });
  } catch (err: any) {
    res.status(404).json({ data: null, error: { message: err.message, code: 'INVITATION_NOT_FOUND' }, meta: null });
  }
});

// POST /api/auth/accept-invitation
router.post('/accept-invitation', async (req: Request, res: Response) => {
  try {
    const { token, password, full_name } = req.body;
    if (!token || !password || !full_name) {
      res.status(400).json({
        data: null,
        error: { message: 'Token, full name, and password are required', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const invitation = await organizationsService.getInvitationByToken(token);
    const isExpired = new Date(invitation.expires_at) < new Date();
    if (invitation.status !== 'pending' || isExpired) {
      res.status(400).json({
        data: null,
        error: { message: 'Invitation is no longer valid', code: 'INVALID_INVITATION' },
        meta: null,
      });
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Unable to create user');

    await prisma.organizationMember.create({
      data: { orgId: invitation.org.id, userId: authData.user.id, role: invitation.role, status: 'active' },
    });

    await prisma.profile.upsert({
      where: { id: authData.user.id },
      update: {},
      create: { id: authData.user.id, orgId: invitation.org.id, businessName: full_name, businessEmail: invitation.email },
    });

    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    });

    const session = await signIn(invitation.email, password);
    res.status(201).json({
      data: {
        user: authData.user,
        org: { ...invitation.org, role: invitation.role },
        token: session.session?.access_token,
        session: session.session,
      },
      error: null,
      meta: null,
    });
  } catch (err: any) {
    res.status(400).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        data: null,
        error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const data = await signIn(email, password);
    res.json({ data: { user: data.user, session: data.session }, error: null, meta: null });
  } catch (err: any) {
    res.status(401).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware as any, async (_req: Request, res: Response) => {
  res.json({ data: { success: true }, error: null, meta: null });
});

// GET /api/auth/me
router.get('/me', authMiddleware as any, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const p = await prisma.profile.findUnique({ where: { id: authReq.userId } });
    const profile = p ? {
      id: p.id,
      org_id: p.orgId,
      business_name: p.businessName,
      business_email: p.businessEmail,
      logo_url: p.logoUrl,
      currency: p.currency,
    } : null;

    res.json({
      data: {
        id: authReq.userId,
        email: authReq.userEmail,
        full_name: profile?.business_name || authReq.userEmail,
        profile,
        org: authReq.org,
        role: authReq.org.role,
      },
      error: null,
      meta: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

// POST /api/auth/magic-link
router.post('/magic-link', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        data: null,
        error: { message: 'Email is required', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/dashboard`,
      },
    });

    if (error) throw error;
    res.json({ data: { message: 'Magic link sent' }, error: null, meta: null });
  } catch (err: any) {
    res.status(400).json({ data: null, error: { message: err.message, code: 'AUTH_ERROR' }, meta: null });
  }
});

export default router;
