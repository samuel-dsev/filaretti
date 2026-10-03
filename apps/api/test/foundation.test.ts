import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../src/app';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { testEnvironment } from './helpers';
import type { ApiErrorResponse } from '@filaretti/types';

test('HTTP errors, request IDs and logging never disclose request secrets', async () => {
  const logs: string[] = [];
  const app = await createApplication(
    testEnvironment(),
    new SanitizedLogger((line) => logs.push(line)),
  );
  await app.listen(0, '127.0.0.1');
  try {
    const url = await app.getUrl();
    const marker = 'private-request-content-secret';
    const response = await fetch(`${url}/api/v1/absent?token=${marker}`, {
      headers: {
        Authorization: `Bearer ${marker}`,
        'X-Request-Id': marker,
        Cookie: `refresh=${marker}`,
      },
    });
    assert.equal(response.status, 404);
    const body = (await response.json()) as ApiErrorResponse;
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.get('x-request-id'), body.error.requestId);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(JSON.stringify(body).includes(marker), false);
    const malformed = await fetch(`${url}/api/v1/absent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"secret":"${marker}`,
    });
    assert.equal(malformed.status, 400);
    assert.equal(((await malformed.json()) as ApiErrorResponse).error.code, 'INVALID_REQUEST');
    assert.equal(logs.join('\n').includes(marker), false);
  } finally {
    await app.close();
  }
});

test('unavailable database returns bounded 503 and no connection credentials', async () => {
  const logs: string[] = [];
  const app = await createApplication(
    testEnvironment(),
    new SanitizedLogger((line) => logs.push(line)),
  );
  await app.listen(0, '127.0.0.1');
  try {
    const started = Date.now();
    const response = await fetch(`${await app.getUrl()}/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', database: 'down' });
    assert.equal(Date.now() - started < 3000, true);
    assert.equal(logs.join('\n').includes('secret-not-for-logs'), false);
  } finally {
    await app.close();
  }
});

test('Swagger is available only in development and disabled for production', async () => {
  for (const nodeEnvironment of ['development', 'production']) {
    const app = await createApplication(
      testEnvironment({ NODE_ENV: nodeEnvironment }),
      new SanitizedLogger(() => undefined),
    );
    await app.listen(0, '127.0.0.1');
    try {
      const response = await fetch(`${await app.getUrl()}/api/docs-json`);
      assert.equal(response.status, nodeEnvironment === 'development' ? 200 : 404);
      if (response.status === 200) {
        const schema = (await response.json()) as { paths: Record<string, unknown> };
        assert.ok(schema.paths['/health']);
      }
    } finally {
      await app.close();
    }
  }
});
