import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const target = new URL(process.env.DATABASE_URL ?? 'file:invalid');
if (
  process.env.APP_ENV !== 'staging' ||
  process.env.NODE_ENV !== 'production' ||
  process.env.MOCK_INTEGRATIONS !== 'false' ||
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  target.hostname !== 'postgres' ||
  target.pathname !== '/filaretti_stage' ||
  target.search ||
  target.hash
)
  throw new Error('ISOLATED_STAGING_DATABASE_REQUIRED');

const mode = process.argv[2] ?? 'migrate';
const require = createRequire(import.meta.url);
const command =
  mode === 'migrate'
    ? [require.resolve('prisma/build/index.js'), 'migrate', 'deploy']
    : mode === 'import-staging'
      ? ['/app/scripts/vps-import-staging.mjs', '--snapshot', '/snapshot/tables.json']
      : undefined;
if (!command) throw new Error('Expected migrate or import-staging');
const result = spawnSync(process.execPath, command, { stdio: 'inherit', env: process.env });
if (result.error) throw new Error('STAGING_OPERATION_START_FAILED');
process.exit(result.status ?? 1);
