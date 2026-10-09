// Creates (or upgrades) a login with owner or admin access to an existing organisation.
//
//   npm run create-owner --workspace=apps/api -- <email> [organisation name] [--role admin] [--generate]
//
//   --role owner|admin  access level (default owner)
//   --generate          generate a random password and print it once,
//                       instead of prompting for one
//
// Passwords are never passed on the command line or stored in code. Uses
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL from apps/api/.env.
// If the email already has a login, its password is left unchanged and only
// the access is added.

import 'dotenv/config';
import readline from 'node:readline';
import { randomBytes } from 'node:crypto';
import { supabase } from '../src/lib/supabase.js';
import { prisma } from '../src/lib/prisma.js';

function askHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  out._writeToOutput = (s: string) => {
    if (s.startsWith(question)) out.output.write(question);
  };
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); }));
}

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** 16 characters with upper, lower, digit and symbol. */
function generatePassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '@#%&*!?'];
  const all = sets.join('');
  const pick = (chars: string) => chars[randomBytes(1)[0] % chars.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 12 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const roleIdx = args.indexOf('--role');
  const role = roleIdx >= 0 ? args[roleIdx + 1] : 'owner';
  const positional = args.filter((a, i) => !a.startsWith('--') && (roleIdx < 0 || i !== roleIdx + 1));
  const email = positional[0]?.trim().toLowerCase();
  const orgName = positional[1]?.trim();
  if (!email || !email.includes('@') || !['owner', 'admin'].includes(role)) {
    console.error('Usage: npm run create-owner --workspace=apps/api -- <email> [organisation name] [--role owner|admin] [--generate]');
    process.exit(1);
  }

  const orgs = await prisma.organization.findMany({
    where: orgName ? { name: orgName } : {},
    select: { id: true, name: true },
  });
  if (orgs.length === 0) throw new Error(orgName ? `No organisation named "${orgName}"` : 'No organisations exist yet — register one first');
  if (orgs.length > 1) {
    throw new Error(`Several organisations exist (${orgs.map((o) => o.name).join(', ')}). Pass the name as the second argument.`);
  }
  const org = orgs[0];

  let userId = await findUserId(email);
  if (userId) {
    console.log(`Login ${email} already exists — keeping its password.`);
  } else {
    let password: string;
    if (flag('--generate')) {
      password = generatePassword();
    } else {
      password = await askHidden(`New password for ${email}: `);
      const confirm = await askHidden('Repeat password: ');
      if (password !== confirm) throw new Error('Passwords do not match');
      if (password.length < 8) throw new Error('Use at least 8 characters');
    }
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Could not create the login');
    userId = data.user.id;
    console.log(`Created login ${email}.`);
    if (flag('--generate')) console.log(`Password (shown once, store it safely): ${password}`);
  }

  // The app uses one organisation per login, so make this the user's only active membership.
  await prisma.$transaction([
    prisma.organizationMember.updateMany({ where: { userId, orgId: { not: org.id } }, data: { status: 'suspended' } }),
    prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId } },
      create: { orgId: org.id, userId, role, status: 'active' },
      update: { role, status: 'active' },
    }),
    prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, orgId: org.id, businessEmail: email },
      update: { orgId: org.id },
    }),
  ]);

  console.log(`${email} now has ${role} access to "${org.name}".`);
}

main()
  .catch((err) => {
    console.error(`Failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
