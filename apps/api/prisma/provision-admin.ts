import { hashPassword } from '../src/auth/password';
import { createSeedClient, reportSeedFailure } from './seed-client';

async function readPassword(): Promise<string> {
  if (process.stdin.isTTY) throw new Error('PASSWORD_STDIN_REQUIRED');
  let value = '';
  for await (const chunk of process.stdin) {
    value += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (value.length > 256) throw new Error('INVALID_PASSWORD');
  }
  const password = value.replace(/\r?\n$/, '');
  if (
    password.length < 16 ||
    password.length > 128 ||
    /[\r\n\0]/.test(password) ||
    password === 'Local-F2-Ficticio!2026'
  ) {
    throw new Error('INVALID_PASSWORD');
  }
  return password;
}

async function main(): Promise<void> {
  if (
    process.env.APP_ENV !== 'production' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.MOCK_CONTENT !== 'false'
  ) {
    throw new Error('ADMIN_PROVISION_FORBIDDEN');
  }
  const email = process.env.PROVISION_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.PROVISION_ADMIN_NAME?.trim();
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.endsWith('.test') ||
    !name ||
    name.length > 160
  ) {
    throw new Error('INVALID_ADMIN_IDENTITY');
  }
  const passwordHash = await hashPassword(await readPassword());
  const client = createSeedClient();
  try {
    await client.$transaction(async (tx) => {
      // Serialize first-admin provisioning, even across simultaneous processes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741937, 2)`;
      if (await tx.user.count({ where: { role: 'ADMIN', isActive: true } }))
        throw new Error('ADMIN_ALREADY_EXISTS');
      const admin = await tx.user.create({
        data: { email, name, passwordHash, role: 'ADMIN', passwordChangedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorId: admin.id,
          action: 'user.provisioned',
          resource: 'user',
          resourceId: admin.id,
        },
      });
    });
    process.stdout.write('First administrator provisioned.\n');
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module)
  main().catch((error: unknown) => reportSeedFailure('ADMIN_PROVISION_FAILED', error));
