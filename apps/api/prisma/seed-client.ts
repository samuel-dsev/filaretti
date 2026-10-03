import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createSeedClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max: 2 }),
    errorFormat: 'minimal',
    log: [],
  });
}

const allowedFailureCodes = new Set([
  'DATABASE_URL_REQUIRED',
  'DEVELOPMENT_SEED_FORBIDDEN',
  'PRODUCTION_SEED_FORBIDDEN',
  'SEED_IDENTITY_COLLISION',
  'ADMIN_PROVISION_FORBIDDEN',
  'PASSWORD_STDIN_REQUIRED',
  'INVALID_PASSWORD',
  'INVALID_ADMIN_IDENTITY',
  'ADMIN_ALREADY_EXISTS',
]);

export function reportSeedFailure(code: string, error?: unknown): void {
  // Prisma diagnostics can contain SQL values or connection details. Never print them.
  const safeCode =
    error instanceof Error && allowedFailureCodes.has(error.message) ? error.message : code;
  process.stderr.write(`${safeCode}\n`);
  process.exitCode = 1;
}
