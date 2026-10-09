// Development-only login bypass: any email + password signs in.
//
// Enabled ONLY when AUTH_BYPASS=true and NODE_ENV is not "production".
// The role comes from the email so every permission level can be tested:
//   contains "staff" → staff, contains "admin" → admin, otherwise owner.
// Everyone lands in one test organisation (DEV_ORG_NAME, default "Demo Business").

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

function roleFor(email: string): 'owner' | 'admin' | 'staff' {
  if (email.includes('staff')) return 'staff';
  if (email.includes('admin')) return 'admin';
  return 'owner';
}

/** Creates (once) the user, the test organisation and the membership; returns what the auth middleware needs. */
export async function ensureDevUser(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const name = email.split('@')[0];
  const [user] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO auth.users (email, full_name, last_sign_in_at)
    VALUES (${email}, ${name}, NOW())
    ON CONFLICT (email) DO UPDATE SET last_sign_in_at = NOW()
    RETURNING id
  `;

  const orgName = process.env.DEV_ORG_NAME || 'Demo Business';
  let org = await prisma.organization.findFirst({ where: { name: orgName }, select: { id: true, name: true, ownerId: true } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName, slug: `demo-${Date.now().toString(36)}`, ownerId: user.id },
      select: { id: true, name: true, ownerId: true },
    });
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { orgId: org.id, businessName: orgName },
      create: { id: user.id, orgId: org.id, businessName: orgName, businessEmail: email, currency: 'INR' },
    });
  }

  const role = org.ownerId === user.id ? 'owner' : roleFor(email);
  await prisma.organizationMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    create: { orgId: org.id, userId: user.id, role, status: 'active' },
    update: { role, status: 'active' },
  });
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { orgId: org.id },
    create: { id: user.id, orgId: org.id, businessEmail: email },
  });

  return { id: user.id, email, org: { id: org.id, name: org.name, role } };
}
