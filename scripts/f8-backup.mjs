import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

const keyPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp|avif|pdf)$/u;
export const hashFile = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
function encryptionKey(hex) {
  if (!/^[a-f0-9]{64}$/u.test(hex ?? '')) throw new Error('BACKUP_ENCRYPTION_KEY_REQUIRED');
  return Buffer.from(hex, 'hex');
}
export function childProcess(args, options = {}) {
  const child = spawn('docker', args, {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
  // Driver diagnostics may contain connection information. Publish only a bounded label.
  child.stderr.on('data', () => {});
  const completed = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('LOCAL_DATABASE_TOOL_UNAVAILABLE')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('LOCAL_DATABASE_TOOL_FAILED')),
    );
  });
  // Attach immediately; pipeline failures and child termination are handled together.
  completed.catch(() => {});
  return { child, completed };
}
export function localDatabase(urlString) {
  const url = new URL(urlString);
  const name = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '5434' ||
    !/^filaretti_[a-z0-9_]+$/u.test(name) ||
    !/^[a-zA-Z0-9_]+$/u.test(user)
  )
    throw new Error('LOCAL_FILARETTI_DATABASE_REQUIRED');
  const container = process.env.F8_PG_CONTAINER ?? 'filaretti-local-postgres-1';
  if (container !== 'filaretti-local-postgres-1' && !/^[a-f0-9]{64}$/u.test(container))
    throw new Error('ISOLATED_POSTGRES_CONTAINER_REQUIRED');
  return { name, user, container };
}
async function safeDirectory(path) {
  const full = resolve(path);
  let current = full;
  for (;;) {
    try {
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_DIRECTORY');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return full;
}
async function encryptStream(source, destination, key, identity) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(identity));
  await pipeline(source, cipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}
export async function decryptToFile(snapshot, entry, keyHex, destination) {
  const key = encryptionKey(keyHex);
  if (!/^[a-z0-9-]+\.enc$/u.test(entry.archive)) throw new Error('INVALID_ARCHIVE_ENTRY');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'hex'));
  decipher.setAAD(Buffer.from(entry.identity));
  decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
  // An existing destination belongs to the caller and must never be deleted.
  const output = await open(destination, 'wx', 0o600);
  try {
    await pipeline(
      createReadStream(join(snapshot, entry.archive)),
      decipher,
      output.createWriteStream(),
    );
    if ((await hashFile(destination)) !== entry.sha256) throw new Error('BACKUP_CHECKSUM_MISMATCH');
  } catch {
    await output.close().catch(() => {});
    await rm(destination, { force: true });
    throw new Error('BACKUP_INTEGRITY_FAILED');
  }
}
export async function createLocalBackup({
  databaseUrl,
  storageRoot,
  outputRoot,
  keyHex,
  revision,
}) {
  const key = encryptionKey(keyHex);
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('COMMIT_REVISION_REQUIRED');
  const database = localDatabase(databaseUrl);
  const storage = await safeDirectory(storageRoot);
  const output = await safeDirectory(outputRoot);
  const nesting = relative(storage, output);
  if (!nesting || (!nesting.startsWith('..') && !isAbsolute(nesting)))
    throw new Error('BACKUP_OUTSIDE_STORAGE_REQUIRED');
  await mkdir(output, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const temporary = join(output, `incomplete-${id}`);
  const snapshot = join(output, `snapshot-${id}`);
  await mkdir(temporary, { mode: 0o700 });
  const manifest = { format: 1, revision, createdAt: new Date().toISOString(), files: [] };
  try {
    const dump = childProcess([
      'exec',
      database.container,
      'pg_dump',
      '-U',
      database.user,
      '-d',
      database.name,
      '--format=custom',
      '--no-owner',
      '--no-acl',
    ]);
    dump.child.stdin.end();
    const dumpHash = createHash('sha256');
    dump.child.stdout.on('data', (chunk) => dumpHash.update(chunk));
    manifest.database = { archive: 'database.enc', identity: `${id}:database` };
    const [encryption] = await Promise.all([
      encryptStream(
        dump.child.stdout,
        join(temporary, 'database.enc'),
        key,
        manifest.database.identity,
      ),
      dump.completed,
    ]);
    Object.assign(manifest.database, encryption, { sha256: dumpHash.digest('hex') });
    for (const visibility of ['public', 'private']) {
      const directory = join(storage, visibility);
      await safeDirectory(directory);
      const names = await readdir(directory).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      for (const name of names.sort()) {
        if (!keyPattern.test(name)) throw new Error('UNEXPECTED_STORAGE_ENTRY');
        const source = join(directory, name);
        const stat = await lstat(source);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORAGE_ENTRY');
        const entry = {
          visibility,
          key: name,
          archive: `file-${manifest.files.length}.enc`,
          identity: `${id}:${visibility}:${name}`,
          bytes: stat.size,
          sha256: await hashFile(source),
        };
        Object.assign(
          entry,
          await encryptStream(
            createReadStream(source),
            join(temporary, entry.archive),
            key,
            entry.identity,
          ),
        );
        manifest.files.push(entry);
      }
    }
    // Encrypt metadata too: object keys/checksums are operational data.
    const envelope = await encryptStream(
      Readable.from([JSON.stringify(manifest)]),
      join(temporary, 'manifest.enc'),
      key,
      `manifest:${id}`,
    );
    await writeFile(
      join(temporary, 'envelope.json'),
      JSON.stringify({ format: 1, id, ...envelope }),
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temporary, snapshot);
    return { snapshot, files: manifest.files.length, revision };
  } catch {
    await rm(temporary, { recursive: true, force: true });
    throw new Error('LOCAL_BACKUP_FAILED');
  }
}
export async function readBackupManifest(snapshot, keyHex) {
  await safeDirectory(snapshot);
  const envelope = JSON.parse(await readFile(join(snapshot, 'envelope.json'), 'utf8'));
  if (envelope.format !== 1 || !/^[a-f0-9-]{36}$/u.test(envelope.id))
    throw new Error('INVALID_BACKUP');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(keyHex),
    Buffer.from(envelope.iv, 'hex'),
  );
  decipher.setAAD(Buffer.from(`manifest:${envelope.id}`));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
  const manifest = JSON.parse(
    Buffer.concat([
      decipher.update(await readFile(join(snapshot, 'manifest.enc'))),
      decipher.final(),
    ]).toString('utf8'),
  );
  if (manifest.format !== 1 || !Array.isArray(manifest.files)) throw new Error('INVALID_BACKUP');
  return manifest;
}
export async function restoreLocalFiles(snapshot, manifest, keyHex, destinationRoot) {
  const root = await safeDirectory(destinationRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const entry of manifest.files) {
    if (!['public', 'private'].includes(entry.visibility) || !keyPattern.test(entry.key))
      throw new Error('INVALID_STORAGE_ENTRY');
    const directory = await safeDirectory(join(root, entry.visibility));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await decryptToFile(snapshot, entry, keyHex, join(directory, entry.key));
  }
}
