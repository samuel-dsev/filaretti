import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const typescript = require('typescript');
const source = readFileSync(new URL('../src/lib/admin-api.ts', import.meta.url), 'utf8');
const javascript = typescript.transpileModule(source, {
  compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022 },
}).outputText;
const freshClient = () =>
  import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}#${Math.random()}`
  );

test('concurrent expired mutations share one refresh and retain their bodies with fresh CSRF', async (t) => {
  const requests = [];
  let refreshCalls = 0;
  const attempts = new Map();
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({
      url,
      method: init.method ?? 'GET',
      csrf: init.headers.get('X-CSRF-Token'),
      body: init.body,
      credentials: init.credentials,
      cache: init.cache,
    });
    if (url.endsWith('auth/csrf')) return Response.json({ csrfToken: 'prelogin-csrf' });
    if (url.endsWith('auth/refresh')) {
      refreshCalls++;
      await new Promise((resolve) => setImmediate(resolve));
      return Response.json({ csrfToken: 'rotated-session-csrf', user: { role: 'EDITOR' } });
    }
    const value = JSON.parse(init.body);
    const attempt = attempts.get(value.title) ?? 0;
    attempts.set(value.title, attempt + 1);
    return attempt === 0
      ? Response.json({ error: { code: 'SESSION_EXPIRED' } }, { status: 401 })
      : Response.json({ title: value.title, saved: true });
  });
  const { adminApi } = await freshClient();
  const bodies = ['first draft', 'second draft'].map((title) =>
    JSON.stringify({ title, version: 8 }),
  );
  const saved = await Promise.all(
    bodies.map((body) => adminApi('admin/articles/id', { method: 'PATCH', body })),
  );
  assert.equal(refreshCalls, 1);
  assert.deepEqual(
    saved.map((item) => item.title),
    ['first draft', 'second draft'],
  );
  const writes = requests.filter((item) => item.url.includes('admin/articles'));
  assert.equal(writes.length, 4);
  assert.deepEqual(
    writes.slice(-2).map((item) => item.body),
    bodies,
  );
  assert.ok(writes.slice(-2).every((item) => item.csrf === 'rotated-session-csrf'));
  assert.ok(
    requests.every((item) => item.credentials === 'same-origin' && item.cache === 'no-store'),
  );
});

test('a version conflict is surfaced once without retry or exposing backend exception text', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    if (url.endsWith('auth/csrf')) return Response.json({ csrfToken: 'test-csrf' });
    return Response.json(
      {
        error: {
          code: 'VERSION_CONFLICT',
          message: 'postgres://secret-host/internal-database stack trace',
        },
      },
      { status: 409 },
    );
  });
  const { adminApi, AdminApiError } = await freshClient();
  await assert.rejects(
    adminApi('admin/articles/id', {
      method: 'PATCH',
      body: JSON.stringify({ version: 2, title: 'Preserve this local text' }),
    }),
    (error) => {
      assert.ok(error instanceof AdminApiError);
      assert.equal(error.code, 'VERSION_CONFLICT');
      assert.equal(error.status, 409);
      assert.match(error.message, /texto foi preservado/iu);
      assert.doesNotMatch(error.message, /postgres|secret-host|stack trace/iu);
      return true;
    },
  );
  assert.equal(calls.filter((url) => url.includes('admin/articles')).length, 1);
  assert.equal(calls.filter((url) => url.endsWith('auth/refresh')).length, 0);
});

test('relationship pickers include later pages and reject a failed later catalog read', async (t) => {
  const calls = [];
  let failingPage = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    const page = Number(new URL(url, 'https://fixture.invalid').searchParams.get('page'));
    calls.push(page);
    return page === failingPage
      ? Response.json({ error: { code: 'UNAVAILABLE' } }, { status: 503 })
      : Response.json({
          data: [{ id: `record-page-${page}` }],
          meta: { page, limit: 50, total: 101, pages: 3 },
        });
  });
  const { adminOptions } = await freshClient();
  assert.deepEqual(
    (await adminOptions('admin/professionals')).map((item) => item.id),
    ['record-page-1', 'record-page-2', 'record-page-3'],
  );
  assert.deepEqual(calls, [1, 2, 3]);
  failingPage = 2;
  await assert.rejects(adminOptions('admin/professionals'), { status: 503 });
});

test('author catalogs omit credentials and never refresh or fetch an administrative path', async (t) => {
  const calls = [];
  let expired = false;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    const page = Number(new URL(url, 'https://fixture.invalid').searchParams.get('page'));
    return expired
      ? Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
      : Response.json({
          data: [{ id: `public-${page}` }],
          meta: { page, limit: 50, total: 51, pages: 2 },
        });
  });
  const { publicOptions } = await freshClient();
  assert.deepEqual(
    (await publicOptions('professionals')).map((item) => item.id),
    ['public-1', 'public-2'],
  );
  assert.ok(
    calls.every(
      ({ url, init }) =>
        url.startsWith('/api/v1/professionals?') &&
        init.method === 'GET' &&
        init.credentials === 'omit' &&
        init.cache === 'no-store',
    ),
  );
  await assert.rejects(publicOptions('admin/users'), { status: 400 });
  assert.equal(calls.length, 2);
  expired = true;
  await assert.rejects(publicOptions('professionals'), { status: 401 });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ url }) => !url.includes('auth/refresh')));
});
