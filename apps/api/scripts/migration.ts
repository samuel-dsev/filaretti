import 'reflect-metadata';
import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseMigrationBatch, MigrationFailure } from '../src/release/migration-contract';
import { migrateBatch } from '../src/release/migration-importer';

async function main() {
  const { values } = parseArgs({
    options: {
      batch: { type: 'string' },
      actor: { type: 'string' },
      apply: { type: 'boolean', default: false },
      'confirm-sha256': { type: 'string' },
      'confirm-database': { type: 'string' },
      offline: { type: 'boolean', default: false },
    },
  });
  if (!values.batch) throw new Error('INVALID_BATCH_FILE');
  const path = resolve(__dirname, '../../..', values.batch);
  if ((await stat(path)).size > 10_000_000) throw new Error('INVALID_BATCH_FILE');
  const batch = parseMigrationBatch(JSON.parse(await readFile(path, 'utf8')) as unknown);
  if (values.offline) {
    if (values.apply) throw new Error('INVALID_OPTIONS');
    process.stdout.write(
      JSON.stringify({
        ok: true,
        mode: 'offline-validation',
        databaseChecked: false,
        fixture: batch.fixture,
        batchId: batch.batchId,
        sha256: batch.sha256,
        records: batch.records.length,
        urls: batch.urls.length,
      }) + '\n',
    );
    return;
  }
  if (!values.actor || !process.env.DATABASE_URL) throw new Error('DATABASE_AND_ACTOR_REQUIRED');
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 5000,
    }),
    log: [],
    errorFormat: 'minimal',
  });
  try {
    const report = await migrateBatch(db, batch, {
      actorId: values.actor,
      apply: values.apply,
      confirmSha256: values['confirm-sha256'],
      confirmDatabase: values['confirm-database'],
      environment: process.env,
    });
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  const report =
    error instanceof MigrationFailure
      ? { ok: false, issues: error.issues }
      : { ok: false, issues: [{ code: 'MIGRATION_COMMAND_FAILED', record: null }] };
  process.stderr.write(JSON.stringify(report) + '\n');
  process.exitCode = 1;
});
