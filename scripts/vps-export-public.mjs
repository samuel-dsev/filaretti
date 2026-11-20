import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = resolve(root, 'apps/api');
const outputRoot = resolve(root, '.local/hostinger-deployment');
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iu;
const mediaKey =
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(jpg|png|webp|avif|pdf)$/u;
const mimeTypes = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  pdf: 'application/pdf',
};

// Explicit columns prevent a later schema addition from exporting private data.
// Source account IDs are replaced inside SQL, before any rows leave PostgreSQL.
const definitions = {
  media: {
    columns:
      'id owner_id visibility storage_key storage_driver public_url mime_type size alt source license is_mock version created_at updated_at',
    condition:
      "visibility='PUBLIC' AND public_url = '/media/public/' || storage_key AND NOT EXISTS (SELECT 1 FROM contact_attachments ca WHERE ca.media_id=t.id)",
  },
  professionals: {
    columns:
      'id slug name title bio education experience photo_media_id is_active sort_order version is_mock created_at updated_at',
    condition: 'is_active',
  },
  practice_areas: {
    columns:
      'id slug name summary description services is_active sort_order version is_mock created_at updated_at',
    condition: 'is_active',
  },
  categories: {
    columns: 'id slug name is_active version is_mock created_at updated_at',
    condition: 'is_active',
  },
  tags: {
    columns: 'id slug name is_active version is_mock created_at updated_at',
    condition: 'is_active',
  },
  articles: {
    columns:
      'id slug title excerpt content type status author_id created_by_id updated_by_id cover_media_id pdf_media_id featured reading_time_minutes seo_title seo_description version published_at scheduled_at is_mock created_at updated_at',
    condition: "status='PUBLISHED' AND published_at <= now()",
  },
  pages: {
    columns:
      'id slug title sections status published_at seo_title seo_description version is_mock created_at updated_at',
    condition: "status='PUBLISHED' AND published_at <= now()",
  },
  faqs: {
    columns:
      'id question answer practice_area_id is_active sort_order version is_mock created_at updated_at',
    condition: 'is_active',
  },
  site_settings: {
    columns:
      'id site_name public_email public_phone whatsapp_url address social_links version is_mock created_at updated_at',
    condition: "id='site'",
  },
  redirects: {
    columns: 'id source_path target_path status_code is_active version created_at updated_at',
    condition: 'is_active',
  },
  professional_practice_areas: {
    columns: 'professional_id practice_area_id',
    condition: 'true',
  },
  article_categories: { columns: 'article_id category_id', condition: 'true' },
  article_tags: { columns: 'article_id tag_id', condition: 'true' },
  article_practice_areas: { columns: 'article_id practice_area_id', condition: 'true' },
};
const joins = {
  professional_practice_areas: {
    professional_id: 'professionals',
    practice_area_id: 'practice_areas',
  },
  article_categories: { article_id: 'articles', category_id: 'categories' },
  article_tags: { article_id: 'articles', tag_id: 'tags' },
  article_practice_areas: { article_id: 'articles', practice_area_id: 'practice_areas' },
};

class ExportFailure extends Error {
  constructor(code, details) {
    super(code);
    this.code = code;
    this.details = details;
  }
}
const fail = (code, details) => {
  throw new ExportFailure(code, details);
};
const requireCondition = (condition, code) => {
  if (!condition) fail(code);
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const quote = (identifier) => {
  requireCondition(/^[a-z_]+$/u.test(identifier), 'INVALID_IDENTIFIER');
  return `"${identifier}"`;
};
const within = (parent, child, allowSame = false) => {
  const path = relative(parent, child);
  return (
    (allowSame || path.length > 0) &&
    !isAbsolute(path) &&
    path !== '..' &&
    !path.startsWith(`..${sep}`)
  );
};

function argumentsFromCli() {
  const options = {};
  const values = process.argv.slice(2);
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (name === '--help') return { help: true };
    requireCondition(['--output', '--actor'].includes(name), 'INVALID_ARGUMENT');
    requireCondition(
      !options[name] &&
        typeof values[index + 1] === 'string' &&
        !values[index + 1].startsWith('--'),
      'INVALID_ARGUMENT',
    );
    options[name] = values[index + 1];
    index += 1;
  }
  return {
    output: options['--output'],
    actorId: options['--actor'] ?? process.env.VPS_STAGE_ACTOR_ID,
  };
}

function validatePaths(output) {
  requireCondition(typeof output === 'string' && output.trim().length > 0, 'OUTPUT_REQUIRED');
  const destination = resolve(root, output);
  requireCondition(within(outputRoot, destination), 'OUTPUT_OUTSIDE_ALLOWED_ROOT');
  // Reject symlinks in existing ancestors, including .local and the allowed root.
  for (const ancestor of [resolve(root, '.local'), outputRoot]) {
    if (existsSync(ancestor)) {
      requireCondition(
        lstatSync(ancestor).isDirectory() && !lstatSync(ancestor).isSymbolicLink(),
        'UNSAFE_OUTPUT_DIRECTORY',
      );
      requireCondition(
        within(realpathSync(root), realpathSync(ancestor)),
        'UNSAFE_OUTPUT_DIRECTORY',
      );
    }
  }
  let ancestor = outputRoot;
  for (const part of relative(outputRoot, dirname(destination)).split(sep).filter(Boolean)) {
    ancestor = resolve(ancestor, part);
    if (existsSync(ancestor))
      requireCondition(
        lstatSync(ancestor).isDirectory() && !lstatSync(ancestor).isSymbolicLink(),
        'UNSAFE_OUTPUT_DIRECTORY',
      );
  }
  requireCondition(!existsSync(destination), 'OUTPUT_ALREADY_EXISTS');
  return destination;
}

function sourceConfiguration() {
  requireCondition(process.env.APP_ENV === 'development', 'DEVELOPMENT_SOURCE_REQUIRED');
  let database;
  try {
    database = new URL(process.env.DATABASE_URL);
  } catch {
    fail('SOURCE_DATABASE_REQUIRED');
  }
  requireCondition(
    ['postgres:', 'postgresql:'].includes(database.protocol),
    'INVALID_SOURCE_DATABASE',
  );
  requireCondition(
    ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname),
    'LOOPBACK_SOURCE_REQUIRED',
  );
  requireCondition(database.pathname === '/filaretti_dev', 'DEVELOPMENT_DATABASE_REQUIRED');
  requireCondition(
    [...database.searchParams.keys()].every((name) => name === 'schema') &&
      (!database.searchParams.has('schema') || database.searchParams.get('schema') === 'public'),
    'SOURCE_DATABASE_OVERRIDE_FORBIDDEN',
  );
  requireCondition(!database.hash, 'INVALID_SOURCE_DATABASE');
  const publicRoot = realpathSync(
    resolve(api, process.env.STORAGE_LOCAL_PATH ?? '../../.local/storage', 'public'),
  );
  requireCondition(lstatSync(publicRoot).isDirectory(), 'PUBLIC_STORAGE_REQUIRED');
  return { database, publicRoot };
}

async function readPublic(database, actorId) {
  const require = createRequire(resolve(api, 'package.json'));
  const { Client } = require('pg');
  const client = new Client({
    connectionString: database.href,
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
    statement_timeout: 30000,
  });
  let connected = false;
  let operation = 'connect';
  try {
    await client.connect();
    connected = true;
    operation = 'begin-read-only';
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = {};
    for (const [name, definition] of Object.entries(definitions)) {
      operation = name;
      const columns = definition.columns.split(' ');
      const projection = columns
        .map((column) => {
          let expression = `t.${quote(column)}`;
          if (column === 'owner_id' || column === 'created_by_id') expression = '$1::uuid';
          if (column === 'updated_by_id')
            expression = 'CASE WHEN t.updated_by_id IS NULL THEN NULL ELSE $1::uuid END';
          return `'${column}', ${expression}`;
        })
        .join(', ');
      const result = await client.query(
        `SELECT jsonb_build_object(${projection}) AS row FROM ${quote(name)} t WHERE ${definition.condition} ORDER BY ${columns
          .slice(0, name in joins ? 2 : 1)
          .map((column) => `t.${quote(column)}`)
          .join(', ')}`,
        name === 'media' || name === 'articles' ? [actorId] : [],
      );
      tables[name] = result.rows.map(({ row }) => row);
    }
    operation = 'commit-read-only';
    await client.query('COMMIT');
    return tables;
  } catch (error) {
    if (connected) await client.query('ROLLBACK').catch(() => {});
    fail('PUBLIC_DATABASE_READ_FAILED', {
      operation,
      databaseCode: /^[A-Z0-9_]{2,40}$/u.test(error?.code ?? '') ? error.code : null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}

function filterReferences(tables) {
  const ids = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, new Set(rows.map((row) => row.id))]),
  );
  for (const row of tables.professionals)
    if (!ids.media.has(row.photo_media_id)) row.photo_media_id = null;
  for (const row of tables.articles) {
    if (!ids.professionals.has(row.author_id)) row.author_id = null;
    if (!ids.media.has(row.cover_media_id)) row.cover_media_id = null;
    if (!ids.media.has(row.pdf_media_id)) row.pdf_media_id = null;
  }
  tables.faqs = tables.faqs.filter(
    (row) => !row.practice_area_id || ids.practice_areas.has(row.practice_area_id),
  );
  for (const [name, references] of Object.entries(joins)) {
    tables[name] = tables[name].filter((row) =>
      Object.entries(references).every(([column, target]) => ids[target].has(row[column])),
    );
  }
  requireCondition(
    tables.pages.some((row) => row.slug === 'home'),
    'PUBLISHED_HOME_REQUIRED',
  );
  requireCondition(tables.site_settings.length === 1, 'PUBLIC_SETTINGS_REQUIRED');
}

function inspectMedia(tables, publicRoot) {
  return tables.media.map((row) => {
    requireCondition(
      row.storage_driver === 'local' && row.visibility === 'PUBLIC',
      'NONLOCAL_PUBLIC_MEDIA',
    );
    requireCondition(
      typeof row.storage_key === 'string' && mediaKey.test(row.storage_key),
      'INVALID_MEDIA_KEY',
    );
    requireCondition(
      row.public_url === `/media/public/${row.storage_key}`,
      'INVALID_PUBLIC_MEDIA_URL',
    );
    const extension = row.storage_key.split('.').at(-1);
    requireCondition(row.mime_type === mimeTypes[extension], 'INVALID_MEDIA_MIME');
    const source = resolve(publicRoot, row.storage_key);
    requireCondition(
      existsSync(source) && !lstatSync(source).isSymbolicLink() && lstatSync(source).isFile(),
      'PUBLIC_MEDIA_FILE_REQUIRED',
    );
    requireCondition(
      relative(publicRoot, realpathSync(source)) === row.storage_key,
      'UNSAFE_MEDIA_PATH',
    );
    const content = readFileSync(source);
    requireCondition(
      Number.isSafeInteger(row.size) && row.size === content.length,
      'MEDIA_SIZE_MISMATCH',
    );
    requireCondition(
      content.length > 0 && content.length <= (extension === 'pdf' ? 10 : 5) * 1024 * 1024,
      'MEDIA_SIZE_LIMIT',
    );
    return { key: row.storage_key, sha256: sha256(content), bytes: content.length, source };
  });
}

async function main() {
  const options = argumentsFromCli();
  if (options.help) {
    console.log(
      'Usage: node scripts/vps-export-public.mjs --output .local/hostinger-deployment/NEW_DIRECTORY [--actor UUID]',
    );
    console.log(
      'Requires APP_ENV=development, loopback DATABASE_URL for filaretti_dev, and VPS_STAGE_ACTOR_ID if --actor is absent. No .env is loaded.',
    );
    return;
  }
  requireCondition(
    typeof options.actorId === 'string' && uuid.test(options.actorId),
    'NEW_ACTOR_UUID_REQUIRED',
  );
  options.actorId = options.actorId.toLowerCase();
  const destination = validatePaths(options.output);
  const { database, publicRoot } = sourceConfiguration();
  const tables = await readPublic(database, options.actorId);
  filterReferences(tables);
  const inspected = inspectMedia(tables, publicRoot);
  // is_mock values are intentionally copied unchanged. This is not a production promotion.
  for (const row of tables.media) assert.equal(row.owner_id, options.actorId);
  for (const row of tables.articles) {
    assert.equal(row.created_by_id, options.actorId);
    assert.ok(row.updated_by_id === null || row.updated_by_id === options.actorId);
  }
  const exportedAt = new Date().toISOString();
  const media = inspected.map(({ key, sha256: digest, bytes }) => ({ key, sha256: digest, bytes }));
  const snapshot = {
    purpose: 'staging-public-only',
    version: 1,
    actorId: options.actorId,
    exportedAt,
    tables,
    media,
  };
  const serialized = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  requireCondition(serialized.length <= 20 * 1024 * 1024, 'SNAPSHOT_SIZE_LIMIT');
  // Check again after the read; mkdir without recursive reserves this output exclusively.
  validatePaths(options.output);
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  mkdirSync(destination, { mode: 0o700 });
  const storage = resolve(destination, 'storage/public');
  mkdirSync(storage, { recursive: true, mode: 0o700 });
  const files = [{ path: 'tables.json', sha256: sha256(serialized), bytes: serialized.length }];
  for (const asset of inspected) {
    const target = resolve(storage, asset.key);
    copyFileSync(asset.source, target, constants.COPYFILE_EXCL);
    requireCondition(sha256(readFileSync(target)) === asset.sha256, 'COPIED_MEDIA_HASH_MISMATCH');
    files.push({ path: `storage/public/${asset.key}`, sha256: asset.sha256, bytes: asset.bytes });
  }
  writeFileSync(resolve(destination, 'tables.json'), serialized, { flag: 'wx', mode: 0o600 });
  const counts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length]),
  );
  const manifest = {
    purpose: 'staging-public-only',
    version: 1,
    exportedAt,
    actorId: options.actorId,
    tablesSha256: files[0].sha256,
    counts,
    publicMediaFiles: media.length,
    privateRowsCopied: 0,
    files,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(destination, 'manifest.json'), manifestBytes, { flag: 'wx', mode: 0o600 });
  files.push({ path: 'manifest.json', sha256: sha256(manifestBytes), bytes: manifestBytes.length });
  writeFileSync(
    resolve(destination, 'SHA256SUMS'),
    files.map((file) => `${file.sha256}  ${file.path}\n`).join(''),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      ok: true,
      purpose: snapshot.purpose,
      output: relative(root, destination),
      tablesSha256: files[0].sha256,
      counts,
      publicMediaFiles: media.length,
      privateRowsCopied: 0,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      code: error instanceof ExportFailure ? error.code : 'PUBLIC_EXPORT_FAILED',
      ...(error instanceof ExportFailure && error.details ? { details: error.details } : {}),
    }),
  );
  process.exitCode = 1;
});
