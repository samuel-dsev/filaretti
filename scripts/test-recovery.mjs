import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn, execFileSync } from 'node:child_process';
import {
  childProcess,
  createLocalBackup,
  decryptToFile,
  hashFile,
  localDatabase,
  readBackupManifest,
  restoreLocalFiles,
} from './f8-backup.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: join(root, 'apps/api/.env'), quiet: true });
const { Client } = require('pg');
const { PDFDocument } = require('pdf-lib');
if (process.env.APP_ENV !== 'development' || !process.env.npm_execpath)
  throw new Error('ISOLATED_LOCAL_RECOVERY_ONLY');
const base = localDatabase(process.env.DATABASE_URL);
const suffix = randomUUID().replaceAll('-', '');
const names = [`filaretti_f8_backup_${suffix}`, `filaretti_f8_restore_${suffix}`];
const created = [];
const workspace = resolve(root, '.local', `f8-recovery-${suffix}`);
const localRoot = resolve(root, '.local');
const key = randomBytes(32).toString('hex');
const operator = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const report = {
  phase: 'F8',
  checkedAt: new Date().toISOString(),
  checks: [],
  scope: 'isolated local PostgreSQL and local public/private storage',
  externalRestore: false,
};
const databaseUrl = (name) => {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return url.href;
};
async function check(name, action) {
  await action();
  report.checks.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function runPnpm(args, databaseName) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: join(root, 'apps/api'),
      windowsHide: true,
      env: { ...process.env, APP_ENV: 'development', DATABASE_URL: databaseUrl(databaseName) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    child.once('error', () => reject(new Error('RECOVERY_SETUP_FAILED')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('RECOVERY_SETUP_FAILED')),
    );
  });
}
async function snapshotTables(client) {
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const result = {};
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-zA-Z_0-9]+$/u);
    result[tablename] = (
      await client.query(`SELECT count(*)::int AS count FROM "${tablename}"`)
    ).rows[0].count;
  }
  return result;
}
let source, restored;
try {
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  await operator.connect();
  for (const name of names) {
    assert.match(name, /^filaretti_f8_(?:backup|restore)_[a-f0-9]{32}$/u);
    await operator.query(`CREATE DATABASE "${name}"`);
    created.push(name);
  }
  await runPnpm(['exec', 'prisma', 'migrate', 'deploy'], names[0]);
  await runPnpm(['exec', 'tsx', 'prisma/seed-development.ts'], names[0]);
  source = new Client({ connectionString: databaseUrl(names[0]) });
  await source.connect();
  const expected = await snapshotTables(source);
  const storage = join(workspace, 'storage');
  const fixture = await PDFDocument.create();
  fixture.addPage().drawText('F8 recovery: fictitious local document');
  const bytes = Buffer.from(await fixture.save());
  const objects = [];
  for (const visibility of ['public', 'private']) {
    const storageKey = `${randomUUID()}.pdf`;
    const path = join(storage, visibility, storageKey);
    await mkdir(join(storage, visibility), { recursive: true });
    await writeFile(path, bytes, { mode: 0o600 });
    objects.push({ visibility, key: storageKey, path });
    if (visibility === 'private')
      await source.query(
        'INSERT INTO contact_files (id,storage_key,storage_driver,filename,mime_type,size,scan_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          randomUUID(),
          storageKey,
          'local',
          'fictitious-recovery.pdf',
          'application/pdf',
          bytes.length,
          'QUARANTINED',
        ],
      );
  }
  expected.contact_files += 1;
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  let backup, manifest;
  await check('encrypted database and public/private object snapshot', async () => {
    backup = await createLocalBackup({
      databaseUrl: databaseUrl(names[0]),
      storageRoot: storage,
      outputRoot: join(workspace, 'backups'),
      keyHex: key,
      revision,
    });
    manifest = await readBackupManifest(backup.snapshot, key);
    assert.equal(manifest.files.length, 2);
    assert.equal(manifest.revision, revision);
    assert.equal(
      (await readFile(join(backup.snapshot, 'database.enc'))).includes(
        Buffer.from('fictitious-recovery'),
      ),
      false,
    );
  });
  await check('AES-GCM wrong key refuses recovery', async () => {
    await assert.rejects(readBackupManifest(backup.snapshot, randomBytes(32).toString('hex')));
  });
  const dump = join(workspace, 'restore.dump');
  await check('PostgreSQL actual restore in new empty database', async () => {
    await decryptToFile(backup.snapshot, manifest.database, key, dump);
    const restore = childProcess([
      'exec',
      '-i',
      base.container,
      'pg_restore',
      '-U',
      base.user,
      '-d',
      names[1],
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--single-transaction',
    ]);
    restore.child.stdout.on('data', () => {});
    await Promise.all([pipeline(createReadStream(dump), restore.child.stdin), restore.completed]);
    await rm(dump);
    restored = new Client({ connectionString: databaseUrl(names[1]) });
    await restored.connect();
    assert.deepEqual(await snapshotTables(restored), expected);
    assert.equal(
      (
        await restored.query(
          'SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL',
        )
      ).rows[0].n,
      4,
    );
    assert.equal(
      (await restored.query('SELECT storage_key FROM contact_files')).rows[0].storage_key,
      objects[1].key,
    );
  });
  await check('recover both visibility classes and verify original byte hashes', async () => {
    await restoreLocalFiles(backup.snapshot, manifest, key, join(workspace, 'restored-storage'));
    for (const object of objects)
      assert.equal(
        await hashFile(object.path),
        await hashFile(join(workspace, 'restored-storage', object.visibility, object.key)),
      );
  });
  await check('tampered ciphertext is rejected and partial output removed', async () => {
    const entry = manifest.files[0];
    const path = join(backup.snapshot, entry.archive);
    const original = await readFile(path);
    const corrupt = Buffer.from(original);
    corrupt[0] ^= 1;
    await writeFile(path, corrupt);
    const destination = join(workspace, 'corrupt.pdf');
    await assert.rejects(decryptToFile(backup.snapshot, entry, key, destination));
    await assert.rejects(lstat(destination), { code: 'ENOENT' });
    await writeFile(path, original);
  });
  await check('restore refuses path traversal and existing destination overwrite', async () => {
    await assert.rejects(
      restoreLocalFiles(
        backup.snapshot,
        { ...manifest, files: [{ ...manifest.files[0], key: '../outside.pdf' }] },
        key,
        join(workspace, 'restore-bad'),
      ),
    );
    await assert.rejects(
      restoreLocalFiles(backup.snapshot, manifest, key, join(workspace, 'restored-storage')),
    );
    assert.equal(
      await hashFile(objects[0].path),
      await hashFile(join(workspace, 'restored-storage', objects[0].visibility, objects[0].key)),
    );
  });
} catch {
  report.failed = true;
  process.exitCode = 1;
  console.error('Recovery validation failed; inspect the preceding check labels.');
} finally {
  await source?.end().catch(() => {});
  await restored?.end().catch(() => {});
  for (const name of created)
    await operator.query(`DROP DATABASE "${name}" WITH (FORCE)`).catch(() => {
      process.exitCode = 1;
      report.cleanupFailed = true;
    });
  await operator.end().catch(() => {});
  const childPath = relative(localRoot, workspace);
  assert.ok(childPath && !childPath.startsWith('..') && !isAbsolute(childPath));
  await rm(workspace, { recursive: true, force: true });
  await mkdir(localRoot, { recursive: true });
  await writeFile(join(localRoot, 'f8-recovery.json'), JSON.stringify(report, null, 2));
}
