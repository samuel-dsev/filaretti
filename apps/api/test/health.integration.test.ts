import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../src/app';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { testEnvironment } from './helpers';

test('health queries a real PostgreSQL database and reflects success', async () => {
  assert.ok(
    process.env.DATABASE_URL,
    'Configure a real local DATABASE_URL before integration tests',
  );
  const app = await createApplication(
    testEnvironment({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_TIMEOUT_MS: 2000 }),
    new SanitizedLogger(() => undefined),
  );
  await app.listen(0, '127.0.0.1');
  try {
    const response = await fetch(`${await app.getUrl()}/health`);
    assert.equal(
      response.status,
      200,
      'Real PostgreSQL must respond; this test does not skip unavailable databases',
    );
    assert.deepEqual(await response.json(), { status: 'ok', database: 'up' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    await app.close();
  }
});
