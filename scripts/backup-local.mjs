import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createLocalBackup } from './f8-backup.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: resolve(root, 'apps/api/.env'), quiet: true });
if (process.env.APP_ENV !== 'development' || process.env.STORAGE_DRIVER !== 'local')
  throw new Error('LOCAL_DEVELOPMENT_BACKUP_ONLY');
try {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const result = await createLocalBackup({
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: resolve(
      root,
      'apps/api',
      process.env.STORAGE_LOCAL_PATH ?? '../../.local/storage',
    ),
    outputRoot: resolve(root, '.local/backups'),
    keyHex: process.env.BACKUP_ENCRYPTION_KEY,
    revision,
  });
  console.log(
    `Local encrypted backup completed: ${result.files} objects; revision ${result.revision}.`,
  );
} catch {
  console.error(
    'Local backup failed; check isolated services, storage permissions and encryption key.',
  );
  process.exitCode = 1;
}
