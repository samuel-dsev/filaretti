import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const coreUrl = new URL('../src/lib/public-api-core.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === coreUrl && specifier === './public-content-core')
      return nextResolve('./public-content-core.ts', context);
    return nextResolve(specifier, context);
  },
});
const { createPublicApiClient, PublicApiError } = await import(coreUrl);
const baseUrl = 'http://127.0.0.1:3001';
const settings = {
  siteName: 'Escritório fictício',
  publicEmail: null,
  publicPhone: null,
  whatsappUrl: null,
  address: { city: 'Cidade fictícia' },
  socialLinks: [],
};
const document = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto fictício' }] }],
};
const area = {
  id: 'area-ficticia',
  slug: 'area-ficticia',
  name: 'Área fictícia',
  summary: 'Resumo',
  description: document,
  services: [],
  professionals: [],
};
const envelope = (data, limit = 12) => ({
  data,
  meta: { page: 1, limit, total: data.length, pages: data.length ? 1 : 0 },
});
const response = (value) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const code = (expected) => (error) => error instanceof PublicApiError && error.code === expected;

test('public reads omit credentials and persistent caching, allowlist DTO fields and safe links', async () => {
  let init;
  let url;
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async (input, options) => {
      url = String(input);
      init = options;
      return response({
        ...settings,
        secret: 'never-return',
        address: { city: 'Cidade fictícia', internalToken: 'never-return' },
        whatsappUrl: 'javascript:alert(1)',
        socialLinks: [
          { label: 'Seguro', url: 'https://example.test' },
          { label: 'Inseguro', url: '//example.test' },
        ],
      });
    },
  });
  const result = await client.getSettings();
  assert.equal(url, `${baseUrl}/api/v1/settings`);
  assert.equal(init.cache, 'no-store');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal('secret' in result, false);
  assert.deepEqual(result.address, { city: 'Cidade fictícia' });
  assert.equal(result.whatsappUrl, null);
  assert.deepEqual(result.socialLinks, [{ label: 'Seguro', url: 'https://example.test' }]);
});

test('single 404 becomes null; list 404 and upstream failures remain typed errors', async () => {
  const missing = createPublicApiClient({
    baseUrl,
    fetcher: async () => new Response(null, { status: 404 }),
  });
  assert.equal(await missing.getPage('inexistente'), null);
  assert.equal(await missing.getPracticeArea('inexistente'), null);
  assert.equal(await missing.getProfessional('inexistente'), null);
  await assert.rejects(missing.getPracticeAreas(), code('NOT_FOUND'));
  for (const status of [401, 403, 429, 500, 503]) {
    const failing = createPublicApiClient({
      baseUrl,
      fetcher: async () => new Response('internal secret', { status }),
    });
    await assert.rejects(failing.getPage('home'), code('UNAVAILABLE'));
  }
});

test('invalid JSON, DTOs and pagination never become successful empty states', async () => {
  for (const value of [
    {},
    { ...settings, socialLinks: 'invalid' },
    { ...settings, siteName: null },
  ]) {
    const client = createPublicApiClient({ baseUrl, fetcher: async () => response(value) });
    await assert.rejects(client.getSettings(), code('INVALID_RESPONSE'));
  }
  const json = createPublicApiClient({
    baseUrl,
    fetcher: async () => new Response('<html>upstream failure</html>'),
  });
  await assert.rejects(json.getSettings(), code('INVALID_RESPONSE'));
  const metadata = createPublicApiClient({
    baseUrl,
    fetcher: async () =>
      response({ data: [area], meta: { page: 1, limit: 12, total: 1, pages: 100 } }),
  });
  await assert.rejects(metadata.getPracticeAreas(), code('INVALID_RESPONSE'));
});

test('transport errors are sanitized and timeout aborts a pending fetch', async () => {
  const failing = createPublicApiClient({
    baseUrl,
    fetcher: async () => {
      throw new Error('password=secret internal-host');
    },
  });
  await assert.rejects(failing.getSettings(), (error) => {
    assert.equal(error.code, 'UNAVAILABLE');
    assert.equal(error.message.includes('secret'), false);
    assert.equal('cause' in error, false);
    return true;
  });
  const timed = createPublicApiClient({
    baseUrl,
    timeoutMs: 100,
    fetcher: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      }),
  });
  await assert.rejects(timed.getSettings(), code('UNAVAILABLE'));
});

test('bounded filters use the real API contract and cannot change the endpoint path', async () => {
  let seen;
  let calls = 0;
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async (url) => {
      calls += 1;
      seen = new URL(url);
      return response(envelope([]));
    },
  });
  await client.getArticles({
    page: 2,
    limit: 12,
    area: 'area-ficticia',
    professional: 'pessoa-ficticia',
    type: 'GUIDE',
    featured: true,
  });
  assert.equal(seen.pathname, '/api/v1/articles');
  assert.equal(seen.searchParams.get('type'), 'GUIDE');
  assert.equal(seen.searchParams.get('professional'), 'pessoa-ficticia');
  assert.equal(seen.searchParams.get('featured'), 'true');
  await client.getArticles({ featured: false });
  assert.equal(seen.searchParams.get('featured'), 'false');
  assert.throws(() => client.getArticles({ limit: 51 }), code('INVALID_RESPONSE'));
  assert.throws(() => client.getArticles({ featured: 1 }), code('INVALID_RESPONSE'));
  assert.throws(() => client.getPracticeArea('../admin/settings'), code('INVALID_RESPONSE'));
  assert.equal(calls, 2);
});

test('real institutional DTOs are preserved while unsupported media is removed', async () => {
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async () => response(envelope([area])),
  });
  assert.deepEqual((await client.getPracticeAreas()).data[0], area);
  const professional = {
    id: 'profissional-ficticio',
    slug: 'profissional-ficticio',
    name: 'Pessoa fictícia',
    title: 'Perfil fictício',
    photo: { id: 'fake', alt: null, size: 20, mimeType: 'image/svg+xml', url: '/fake.svg' },
    bio: document,
    education: [],
    experience: [],
    practiceAreas: [],
  };
  const profiles = createPublicApiClient({ baseUrl, fetcher: async () => response(professional) });
  assert.equal((await profiles.getProfessional('profissional-ficticio')).photo, null);
});
