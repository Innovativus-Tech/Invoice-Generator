// Development-only login bypass: any email + password signs in.
//
// Enabled ONLY when AUTH_BYPASS=true and NODE_ENV is not "production".
// Each account keeps its own organisation: a user who already belongs to one
// (e.g. through an invite) signs into it; a new email gets a fresh business of
// its own as owner, so no two accounts ever see each other's data.

import { prisma } from './prisma.js';

const TOKEN_PREFIX = 'dev.';

export function isAuthBypassEnabled(): boolean {
  return process.env.AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

if (process.env.AUTH_BYPASS === 'true') {
  console.warn(
    isAuthBypassEnabled()
      ? '⚠️  AUTH_BYPASS is ON — any email/password can log in. Never enable this on a live server.'
      : 'AUTH_BYPASS ignored because NODE_ENV=production.'
  );
}

export const devToken = (email: string) => TOKEN_PREFIX + Buffer.from(email).toString('base64url');

export function emailFromDevToken(token: string): string | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const email = Buffer.from(token.slice(TOKEN_PREFIX.length), 'base64url').toString('utf8');
  return email.includes('@') ? email : null;
}

/** Creates (once) the user and, on first sign-in, their own organisation; returns what the auth middleware needs. */
export async function ensureDevUser(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const name = email.split('@')[0];
  const [user] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO auth.users (email, full_name, last_sign_in_at)
    VALUES (${email}, ${name}, NOW())
    ON CONFLICT (email) DO UPDATE SET last_sign_in_at = NOW()
    RETURNING id
  `;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'asc' },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (membership?.organization) {
    const { id, name: orgName } = membership.organization;
    return { id: user.id, email, org: { id, name: orgName, role: membership.role as 'owner' | 'admin' | 'staff' } };
  }

  // First sign-in: a separate business owned by this user.
  const orgName = `${name}'s Business`;
  const org = await prisma.organization.create({
    data: { name: orgName, slug: `${name.replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now().toString(36)}`, ownerId: user.id },
    select: { id: true, name: true },
  });
  await prisma.organizationMember.create({ data: { orgId: org.id, userId: user.id, role: 'owner', status: 'active' } });
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { orgId: org.id, businessName: orgName },
    create: { id: user.id, orgId: org.id, businessName: orgName, businessEmail: email, currency: 'INR' },
  });

  return { id: user.id, email, org: { id: org.id, name: org.name, role: 'owner' as const } };
}
