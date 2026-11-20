import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a one-time protected-staging bootstrap, not the F9 production importer.
// Source users, sessions, contacts, subscribers, tokens and outbox never enter its allowlist.
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { Client } = requireApi('pg');
const { argon2id, hash } = requireApi('argon2');
const purpose = 'staging-public-only';
const databaseName = 'filaretti_stage';
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/u;
const uuid4 = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const digestPattern = /^[a-f\d]{64}$/u;
const storageKey =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(?:jpg|png|webp|avif|pdf)$/u;
const maxSnapshotBytes = 32 * 1024 * 1024;
const maxMediaBytes = 10 * 1024 * 1024;
const maxRowsPerTable = 10000;
const columns = {
  media: [
    'id',
    'owner_id',
    'visibility',
    'storage_key',
    'storage_driver',
    'public_url',
    'mime_type',
    'size',
    'alt',
    'source',
    'license',
    'is_mock',
    'version',
    'created_at',
    'updated_at',
  ],
  professionals: [
    'id',
    'slug',
    'name',
    'title',
    'bio',
    'education',
    'experience',
    'photo_media_id',
    'is_active',
    'sort_order',
    'version',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  practice_areas: [
    'id',
    'slug',
    'name',
    'summary',
    'description',
    'services',
    'is_active',
    'sort_order',
    'version',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  categories: ['id', 'slug', 'name', 'is_active', 'version', 'is_mock', 'created_at', 'updated_at'],
  tags: ['id', 'slug', 'name', 'is_active', 'version', 'is_mock', 'created_at', 'updated_at'],
  articles: [
    'id',
    'slug',
    'title',
    'excerpt',
    'content',
    'type',
    'status',
    'author_id',
    'created_by_id',
    'updated_by_id',
    'cover_media_id',
    'pdf_media_id',
    'featured',
    'reading_time_minutes',
    'seo_title',
    'seo_description',
    'version',
    'published_at',
    'scheduled_at',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  pages: [
    'id',
    'slug',
    'title',
    'sections',
    'status',
    'published_at',
    'seo_title',
    'seo_description',
    'version',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  faqs: [
    'id',
    'question',
    'answer',
    'practice_area_id',
    'is_active',
    'sort_order',
    'version',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  site_settings: [
    'id',
    'site_name',
    'public_email',
    'public_phone',
    'whatsapp_url',
    'address',
    'social_links',
    'version',
    'is_mock',
    'created_at',
    'updated_at',
  ],
  redirects: [
    'id',
    'source_path',
    'target_path',
    'status_code',
    'is_active',
    'version',
    'created_at',
    'updated_at',
  ],
  professional_practice_areas: ['professional_id', 'practice_area_id'],
  article_categories: ['article_id', 'category_id'],
  article_tags: ['article_id', 'tag_id'],
  article_practice_areas: ['article_id', 'practice_area_id'],
};
const tableNames = Object.keys(columns);
const jsonColumns = new Set([
  'bio',
  'education',
  'experience',
  'description',
  'services',
  'content',
  'sections',
  'answer',
  'address',
  'social_links',
]);
const allTables = [
  ...tableNames,
  'users',
  'sessions',
  'refresh_tokens',
  'password_reset_tokens',
  'login_rate_limits',
  'preview_tokens',
  'contacts',
  'contact_files',
  'contact_download_tickets',
  'contact_attachments',
  'newsletter_subscribers',
  'newsletter_tokens',
  'outbox_tasks',
  'mail_webhook_events',
  'audit_events',
];
const identity = {
  name: 'Operador de homologação Filaretti',
  email: 'admin-vps-staging@example.invalid',
};

class ImportFailure extends Error {}
function assert(condition, code) {
  if (!condition) throw new ImportFailure(code);
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sameKeys(value, expected) {
  return (
    object(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function identifier(value) {
  // All callers use the static allowlists above, never a name from input.
  assert(/^[a-z_]+$/u.test(value), 'INVALID_INTERNAL_IDENTIFIER');
  return `"${value}"`;
}

export function configuration() {
  const env = process.env;
  assert(
    env.APP_ENV === 'staging' && env.NODE_ENV === 'production' && env.MOCK_INTEGRATIONS === 'false',
    'STAGING_ENVIRONMENT_REQUIRED',
  );
  assert(env.VPS_STAGE_IMPORT_CONFIRM === databaseName, 'TARGET_CONFIRMATION_REQUIRED');
  assert(uuid4.test(env.VPS_STAGE_ACTOR_ID ?? ''), 'INVALID_STAGE_ACTOR');
  assert(digestPattern.test(env.VPS_STAGE_SNAPSHOT_SHA256 ?? ''), 'SNAPSHOT_DIGEST_REQUIRED');
  let database;
  try {
    database = new URL(env.DATABASE_URL);
  } catch {
    throw new ImportFailure('INVALID_DATABASE_TARGET');
  }
  assert(
    ['postgres:', 'postgresql:'].includes(database.protocol) &&
      database.hostname === 'postgres' &&
      ['', '5432'].includes(database.port) &&
      database.pathname === `/${databaseName}` &&
      database.username &&
      database.password &&
      !database.hash,
    'INVALID_DATABASE_TARGET',
  );
  assert(
    [...database.searchParams.keys()].every((name) => name === 'schema') &&
      (!database.searchParams.has('schema') || database.searchParams.get('schema') === 'public'),
    'DATABASE_OVERRIDE_FORBIDDEN',
  );
  assert(
    process.argv.length === 4 && process.argv[2] === '--snapshot',
    'SNAPSHOT_ARGUMENT_REQUIRED',
  );
  return {
    actorId: env.VPS_STAGE_ACTOR_ID,
    digest: env.VPS_STAGE_SNAPSHOT_SHA256,
    snapshotPath: resolve(process.argv[3]),
    connectionString: env.DATABASE_URL,
  };
}

export async function readSnapshot(config) {
  const stat = await lstat(config.snapshotPath);
  assert(
    stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maxSnapshotBytes,
    'INVALID_SNAPSHOT_FILE',
  );
  const bytes = await readFile(config.snapshotPath);
  assert(bytes.length === stat.size && sha256(bytes) === config.digest, 'SNAPSHOT_DIGEST_MISMATCH');
  let snapshot;
  try {
    snapshot = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ImportFailure('INVALID_SNAPSHOT_JSON');
  }
  assert(
    sameKeys(snapshot, ['purpose', 'version', 'actorId', 'exportedAt', 'tables', 'media']),
    'INVALID_SNAPSHOT_ENVELOPE',
  );
  assert(
    snapshot.purpose === purpose && snapshot.version === 1 && snapshot.actorId === config.actorId,
    'SNAPSHOT_PURPOSE_MISMATCH',
  );
  const exportedAt = Date.parse(snapshot.exportedAt);
  assert(
    typeof snapshot.exportedAt === 'string' &&
      Number.isFinite(exportedAt) &&
      exportedAt <= Date.now() + 300000,
    'INVALID_SNAPSHOT_DATE',
  );
  assert(
    sameKeys(snapshot.tables, tableNames) && Array.isArray(snapshot.media),
    'INVALID_SNAPSHOT_TABLES',
  );
  const ids = {};
  let totalRows = 0;
  for (const table of tableNames) {
    const rows = snapshot.tables[table];
    assert(Array.isArray(rows) && rows.length <= maxRowsPerTable, 'INVALID_SNAPSHOT_ROWS');
    totalRows += rows.length;
    ids[table] = new Set();
    for (const row of rows) {
      assert(sameKeys(row, columns[table]), 'UNEXPECTED_SNAPSHOT_COLUMNS');
      const key = columns[table].includes('id')
        ? row.id
        : columns[table].map((name) => row[name]).join(':');
      assert(typeof key === 'string' && !ids[table].has(key), 'DUPLICATE_SNAPSHOT_ROW');
      ids[table].add(key);
      for (const [name, value] of Object.entries(row)) {
        if (name === 'id')
          assert(
            table === 'site_settings' ? value === 'site' : uuid.test(value),
            'INVALID_SNAPSHOT_ID',
          );
        else if (name.endsWith('_id'))
          assert(
            value === null || (typeof value === 'string' && uuid.test(value)),
            'INVALID_SNAPSHOT_REFERENCE',
          );
        if (name === 'is_mock') assert(typeof value === 'boolean', 'INVALID_MOCK_MARKER');
        if (name === 'is_active') assert(value === true, 'INACTIVE_SNAPSHOT_RECORD');
        if (jsonColumns.has(name))
          assert(value !== null && typeof value === 'object', 'INVALID_SNAPSHOT_CONTENT');
      }
      if (table === 'articles' || table === 'pages') {
        const publishedAt = Date.parse(row.published_at);
        assert(
          row.status === 'PUBLISHED' &&
            typeof row.published_at === 'string' &&
            Number.isFinite(publishedAt) &&
            publishedAt <= exportedAt,
          'UNPUBLISHED_SNAPSHOT_RECORD',
        );
      }
      if (table === 'media') {
        assert(
          row.visibility === 'PUBLIC' &&
            row.storage_driver === 'local' &&
            storageKey.test(row.storage_key),
          'PRIVATE_OR_UNSUPPORTED_MEDIA',
        );
        const extension = row.storage_key.split('.').at(-1);
        const mimeTypes = {
          jpg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          avif: 'image/avif',
          pdf: 'application/pdf',
        };
        assert(
          row.public_url === `/media/public/${row.storage_key}` &&
            row.mime_type === mimeTypes[extension] &&
            row.size <= (extension === 'pdf' ? 10 : 5) * 1024 * 1024,
          'INVALID_PUBLIC_MEDIA_METADATA',
        );
        assert(
          row.owner_id === config.actorId &&
            Number.isInteger(row.size) &&
            row.size > 0 &&
            row.size <= maxMediaBytes,
          'INVALID_MEDIA_OWNER_OR_SIZE',
        );
      }
      if (table === 'articles')
        assert(
          row.created_by_id === config.actorId &&
            [null, config.actorId].includes(row.updated_by_id),
          'SOURCE_USER_REFERENCE_FORBIDDEN',
        );
    }
  }
  assert(
    totalRows <= 50000 &&
      snapshot.tables.site_settings.length === 1 &&
      snapshot.tables.pages.some((row) => row.slug === 'home'),
    'INVALID_SNAPSHOT_COUNTS',
  );
  const reference = (row, key, table) =>
    assert(row[key] === null || ids[table].has(row[key]), 'MISSING_SNAPSHOT_RELATION');
  for (const row of snapshot.tables.professionals) reference(row, 'photo_media_id', 'media');
  for (const row of snapshot.tables.articles) {
    reference(row, 'author_id', 'professionals');
    reference(row, 'cover_media_id', 'media');
    reference(row, 'pdf_media_id', 'media');
  }
  for (const row of snapshot.tables.faqs) reference(row, 'practice_area_id', 'practice_areas');
  for (const [table, relations] of Object.entries({
    professional_practice_areas: {
      professional_id: 'professionals',
      practice_area_id: 'practice_areas',
    },
    article_categories: { article_id: 'articles', category_id: 'categories' },
    article_tags: { article_id: 'articles', tag_id: 'tags' },
    article_practice_areas: { article_id: 'articles', practice_area_id: 'practice_areas' },
  }))
    for (const row of snapshot.tables[table])
      for (const [key, target] of Object.entries(relations)) {
        assert(row[key] !== null, 'NULL_SNAPSHOT_RELATION');
        reference(row, key, target);
      }

  assert(snapshot.media.length === snapshot.tables.media.length, 'MEDIA_MANIFEST_MISMATCH');
  const mediaByKey = new Map(snapshot.tables.media.map((row) => [row.storage_key, row]));
  assert(mediaByKey.size === snapshot.media.length, 'DUPLICATE_MEDIA_KEY');
  const verified = new Set();
  for (const file of snapshot.media) {
    assert(
      sameKeys(file, ['key', 'sha256', 'bytes']) &&
        typeof file.key === 'string' &&
        storageKey.test(file.key),
      'INVALID_MEDIA_MANIFEST',
    );
    const row = mediaByKey.get(file.key);
    assert(
      row && !verified.has(file.key) && digestPattern.test(file.sha256) && file.bytes === row.size,
      'MEDIA_MANIFEST_MISMATCH',
    );
    const filePath = resolve(dirname(config.snapshotPath), 'storage', 'public', file.key);
    const fileStat = await lstat(filePath);
    assert(
      fileStat.isFile() && !fileStat.isSymbolicLink() && fileStat.size === file.bytes,
      'INVALID_MEDIA_FILE',
    );
    const fileBytes = await readFile(filePath);
    assert(
      fileBytes.length === file.bytes && sha256(fileBytes) === file.sha256,
      'MEDIA_DIGEST_MISMATCH',
    );
    verified.add(file.key);
  }
  return snapshot;
}

async function passwordHash() {
  assert(!process.stdin.isTTY, 'PASSWORD_STDIN_REQUIRED');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    assert(length <= 256, 'INVALID_STAGE_PASSWORD');
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  const password = bytes.toString('utf8').replace(/\r?\n$/u, '');
  assert(
    password.length >= 24 &&
      password.length <= 128 &&
      !/[\r\n\0]/u.test(password) &&
      !/^(.)\1+$/u.test(password),
    'INVALID_STAGE_PASSWORD',
  );
  try {
    return await hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

async function insertRow(client, table, row) {
  const names = columns[table];
  const values = names.map((name) =>
    jsonColumns.has(name) ? JSON.stringify(row[name]) : row[name],
  );
  await client.query(
    `INSERT INTO public.${identifier(table)} (${names.map(identifier).join(',')}) VALUES (${names.map((_, index) => `$${index + 1}`).join(',')})`,
    values,
  );
}

async function main() {
  const config = configuration();
  const snapshot = await readSnapshot(config);
  const hashValue = await passwordHash();
  const client = new Client({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 120000,
  });
  let transaction = false;
  try {
    await client.connect();
    const target = await client.query('SELECT current_database() AS name');
    assert(target.rows[0]?.name === databaseName, 'DATABASE_IDENTITY_MISMATCH');
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(741937, 59)');
    const schema = await client.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    assert(
      schema.rows.length === allTables.length &&
        schema.rows.every((row) => allTables.includes(row.tablename)),
      'TARGET_SCHEMA_MISMATCH',
    );
    await client.query(
      `LOCK TABLE ${allTables.map((name) => `public.${identifier(name)}`).join(',')} IN EXCLUSIVE MODE`,
    );
    for (const table of allTables) {
      const result = await client.query(
        `SELECT EXISTS (SELECT 1 FROM public.${identifier(table)}) AS occupied`,
      );
      assert(result.rows[0]?.occupied === false, 'TARGET_DATABASE_NOT_EMPTY');
    }
    await client.query(
      "INSERT INTO public.users (id,email,name,password_hash,role,is_active,password_changed_at,is_mock,created_at,updated_at) VALUES ($1,$2,$3,$4,'ADMIN',true,now(),true,now(),now())",
      [config.actorId, identity.email, identity.name, hashValue],
    );
    const counts = {};
    for (const table of tableNames) {
      for (const row of snapshot.tables[table]) await insertRow(client, table, row);
      const result = await client.query(
        `SELECT count(*)::int AS count FROM public.${identifier(table)}`,
      );
      counts[table] = result.rows[0].count;
      assert(counts[table] === snapshot.tables[table].length, 'IMPORTED_COUNT_MISMATCH');
    }
    await client.query(
      'INSERT INTO public.audit_events (id,actor_id,action,resource,resource_id,metadata,created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
      [
        randomUUID(),
        config.actorId,
        'staging.public_snapshot.imported',
        'staging',
        'public-snapshot',
        JSON.stringify({
          purpose,
          version: 1,
          snapshotSha256: config.digest,
          counts,
          mockFlagsPreserved: true,
        }),
      ],
    );
    for (const table of allTables.filter(
      (name) => !tableNames.includes(name) && !['users', 'audit_events'].includes(name),
    )) {
      const result = await client.query(
        `SELECT EXISTS (SELECT 1 FROM public.${identifier(table)}) AS occupied`,
      );
      assert(result.rows[0]?.occupied === false, 'PRIVATE_DATA_IMPORT_FORBIDDEN');
    }
    const operatorCount = await client.query('SELECT count(*)::int AS count FROM public.users');
    const auditCount = await client.query('SELECT count(*)::int AS count FROM public.audit_events');
    assert(
      operatorCount.rows[0]?.count === 1 && auditCount.rows[0]?.count === 1,
      'OPERATOR_OR_AUDIT_COUNT_MISMATCH',
    );
    await client.query('COMMIT');
    transaction = false;
    process.stdout.write(
      `${JSON.stringify({ status: 'imported', purpose, version: 1, snapshotSha256: config.digest, counts, operatorCount: 1, sourceUsersImported: 0, privateRecordsImported: 0 })}\n`,
    );
  } catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    // Vendor diagnostics can contain connection URLs, SQL values or passwords.
    const code = error instanceof ImportFailure ? error.message : 'IMPORT_FAILED';
    process.stderr.write(`VPS_STAGE_IMPORT_FAILED: ${code}\n`);
    process.exitCode = 1;
  });
