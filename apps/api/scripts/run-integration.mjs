import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import pg from 'pg';

if (process.env.APP_ENV !== 'development') {
  throw new Error(
    'Integration tests require APP_ENV=development and an isolated local/CI database.',
  );
}
if (!process.env.DATABASE_URL || !process.env.npm_execpath) {
  throw new Error('Run through pnpm with DATABASE_URL configured.');
}
const baseUrl = new URL(process.env.DATABASE_URL);
const databaseName = `filaretti_test_${randomUUID().replaceAll('-', '')}`;
assert.match(databaseName, /^filaretti_test_[a-f0-9]{32}$/);
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const environment = {
  ...process.env,
  DATABASE_URL: testUrl.href,
  NODE_ENV: 'development',
  MOCK_CONTENT: 'true',
};
const redact = (value) => {
  let safe = value.replaceAll(baseUrl.href, '[database]').replaceAll(testUrl.href, '[database]');
  for (const secret of [baseUrl.password, decodeURIComponent(baseUrl.password)]) {
    if (secret) safe = safe.replaceAll(secret, '[redacted]');
  }
  return safe.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[database]');
};
function run(args, label, overrides = {}, expectedFailureCode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
      env: { ...environment, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostics = '';
    const forward = (stream, data) => {
      const safe = redact(data.toString());
      diagnostics = (diagnostics + safe).slice(-16384);
      stream.write(safe);
    };
    child.stdout.on('data', (data) => forward(process.stdout, data));
    child.stderr.on('data', (data) => forward(process.stderr, data));
    child.once('error', () => reject(new Error(`${label} failed to start.`)));
    child.once('exit', (code) => {
      const accepted = expectedFailureCode
        ? code !== 0 && diagnostics.split(/\r?\n/u).includes(expectedFailureCode)
        : code === 0;
      if (accepted) resolve();
      else reject(new Error(`${label} failed (${code}).`));
    });
  });
}
const operator = new pg.Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
let created = false;
let testDatabase;
let structuralCreated = false;
const structuralName = `${databaseName}_structural`;
try {
  await operator.connect();
  await operator.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log('Created isolated integration database.');
  await run(['exec', 'prisma', 'migrate', 'deploy'], 'Migrations');
  await run(
    ['exec', 'tsx', 'prisma/seed-development.ts'],
    'Blocked production development seed',
    {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      MOCK_CONTENT: 'false',
    },
    'DEVELOPMENT_SEED_FORBIDDEN',
  );
  await operator.query(`CREATE DATABASE "${structuralName}"`);
  structuralCreated = true;
  const structuralUrl = new URL(baseUrl);
  structuralUrl.pathname = `/${structuralName}`;
  const production = {
    DATABASE_URL: structuralUrl.href,
    APP_ENV: 'production',
    NODE_ENV: 'production',
    MOCK_CONTENT: 'false',
  };
  await run(['exec', 'prisma', 'migrate', 'deploy'], 'Structural database migrations', production);
  await run(['exec', 'tsx', 'prisma/seed-production.ts'], 'Structural production seed', production);
  await run(['exec', 'tsx', 'prisma/seed-production.ts'], 'Repeated structural seed', production);
  const structural = new pg.Client({ connectionString: structuralUrl.href });
  try {
    await structural.connect();
    const tables = (
      await structural.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','site_settings')",
      )
    ).rows;
    for (const { tablename } of tables) {
      assert.match(tablename, /^[A-Za-z_][A-Za-z_0-9]*$/);
      assert.equal(
        (await structural.query(`SELECT COUNT(*)::int AS total FROM "${tablename}"`)).rows[0].total,
        0,
        'Structural seed must not create users or fictitious content.',
      );
    }
    assert.equal(
      (await structural.query('SELECT COUNT(*)::int AS total FROM site_settings')).rows[0].total,
      1,
    );
    console.log('Production seed is idempotent and contains only structural configuration.');
  } finally {
    await structural.end();
  }
  await run(['exec', 'tsx', 'prisma/seed-development.ts'], 'Development seed');
  testDatabase = new pg.Client({ connectionString: testUrl.href });
  await testDatabase.connect();
  async function counts() {
    const tables = await testDatabase.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
    );
    const snapshot = {};
    for (const { tablename } of tables.rows) {
      assert.match(tablename, /^[A-Za-z_][A-Za-z_0-9]*$/);
      snapshot[tablename] = (
        await testDatabase.query(`SELECT COUNT(*)::int AS total FROM "${tablename}"`)
      ).rows[0].total;
    }
    return snapshot;
  }
  const first = await counts();
  await run(['exec', 'tsx', 'prisma/seed-development.ts'], 'Repeated development seed');
  assert.deepEqual(await counts(), first, 'Seeds must not duplicate rows.');
  console.log('Seed idempotence verified across all domain tables.');
  await testDatabase.end();
  testDatabase = undefined;
  const files = (await readdir('dist-test/test'))
    .filter((name) => name.endsWith('.integration.test.js'))
    .sort(
      (left, right) =>
        Number(right.startsWith('database.')) - Number(left.startsWith('database.')) ||
        left.localeCompare(right),
    );
  assert.ok(files.length >= 3, 'Auth, domain and health integration tests must exist.');
  await run(
    [
      'exec',
      'node',
      '--test',
      '--test-concurrency=1',
      ...files.map((name) => `dist-test/test/${name}`),
    ],
    'PostgreSQL integration',
  );
  await run(
    ['exec', 'node', 'scripts/verify-provision.mjs'],
    'Isolated admin provisioning',
    production,
  );
} catch (error) {
  // Driver/connection errors can carry credentials; publish only our bounded labels.
  console.error(
    error instanceof assert.AssertionError
      ? redact(error.message)
      : 'Integration failed; check local PostgreSQL and the preceding sanitized diagnostics.',
  );
  process.exitCode = 1;
} finally {
  if (testDatabase) await testDatabase.end().catch(() => undefined);
  if (created) {
    await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`).catch(() => {
      console.error(`Could not remove the isolated database ${databaseName}.`);
      process.exitCode = 1;
    });
  }
  if (structuralCreated) {
    await operator.query(`DROP DATABASE "${structuralName}" WITH (FORCE)`).catch(() => {
      console.error(`Could not remove the structural test database ${structuralName}.`);
      process.exitCode = 1;
    });
  }
  await operator.end().catch(() => undefined);
}
