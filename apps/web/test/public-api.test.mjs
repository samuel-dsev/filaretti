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
const article = {
  id: 'conteudo-ficticio',
  slug: 'conteudo-ficticio',
  title: 'Conteúdo fictício',
  excerpt: 'Resumo fictício',
  type: 'GUIDE',
  featured: false,
  publishedAt: '2025-01-01T00:30:00.000Z',
  updatedAt: '2025-02-01T00:00:00.000Z',
  readingTimeMinutes: 1,
  author: {
    id: 'pessoa-ficticia',
    slug: 'pessoa-ficticia',
    name: 'Pessoa fictícia',
    title: 'Perfil fictício',
    photo: null,
  },
  cover: null,
  categories: [],
  tags: [],
  practiceAreas: [],
  content: document,
  pdf: {
    id: 'pdf-ficticio',
    alt: null,
    mimeType: 'application/pdf',
    size: 100,
    url: '/media/public/guia-ficticio.pdf',
  },
  seoTitle: null,
  seoDescription: null,
};
const envelope = (data, limit = 12) => ({
  data,
  meta: { page: 1, limit, total: data.length, pages: data.length ? 1 : 0 },
});

test('public search and sitemap decode allowlists and reject private or external paths', async () => {
  let payload = envelope([
    {
      kind: 'article',
      slug: 'ficticio',
      title: 'Publicação fictícia',
      excerpt: 'Resumo',
      href: '/conteudos/ficticio',
      administrative: 'must-not-leak',
    },
  ]);
  const seen = [];
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async (url, init) => {
      seen.push({ url: String(url), init });
      return Response.json(payload);
    },
  });
  const results = await client.search({ q: 'direito', kind: 'article', page: 2 });
  assert.equal('administrative' in results.data[0], false);
  assert.ok(seen[0].url.includes('public/search?'));
  assert.equal(seen[0].init.cache, 'no-store');
  assert.equal(seen[0].init.credentials, 'omit');
  payload = envelope([
    {
      kind: 'article',
      slug: 'ficticio',
      title: 'Título',
      excerpt: '',
      href: 'https://external.invalid',
    },
  ]);
  await assert.rejects(
    client.search({ q: 'direito' }),
    (error) => error instanceof PublicApiError && error.code === 'INVALID_RESPONSE',
  );
  payload = envelope([{ path: '/preview/private-token', updatedAt: '2026-01-01T00:00:00Z' }]);
  await assert.rejects(
    client.getSitemap(),
    (error) => error instanceof PublicApiError && error.code === 'INVALID_RESPONSE',
  );
  payload = envelope([
    { path: '/conteudos/ficticio', updatedAt: '2026-01-01T00:00:00Z', token: 'must-not-leak' },
  ]);
  assert.deepEqual((await client.getSitemap()).data, [
    { path: '/conteudos/ficticio', updatedAt: '2026-01-01T00:00:00Z' },
  ]);
  for (const q of ['x', 'a'.repeat(121), 'a\u0000b'])
    assert.throws(
      () => client.search({ q }),
      (error) => error instanceof PublicApiError,
    );
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
  assert.equal(await missing.getArticle('inexistente'), null);
  await assert.rejects(missing.getPracticeAreas(), code('NOT_FOUND'));
  await assert.rejects(missing.getEditorialFilters(), code('NOT_FOUND'));
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
    category: 'categoria-ficticia',
    tag: 'tag-ficticia',
    year: 2025,
    sort: 'oldest',
  });
  assert.equal(seen.pathname, '/api/v1/articles');
  assert.equal(seen.searchParams.get('type'), 'GUIDE');
  assert.equal(seen.searchParams.get('professional'), 'pessoa-ficticia');
  assert.equal(seen.searchParams.get('featured'), 'true');
  assert.equal(seen.searchParams.get('category'), 'categoria-ficticia');
  assert.equal(seen.searchParams.get('tag'), 'tag-ficticia');
  assert.equal(seen.searchParams.get('year'), '2025');
  assert.equal(seen.searchParams.get('sort'), 'oldest');
  await client.getArticles({ featured: false });
  assert.equal(seen.searchParams.get('featured'), 'false');
  assert.throws(() => client.getArticles({ limit: 51 }), code('INVALID_RESPONSE'));
  assert.throws(() => client.getArticles({ featured: 1 }), code('INVALID_RESPONSE'));
  for (const query of [
    { category: '../admin' },
    { tag: ['tag-ficticia'] },
    { year: '2025' },
    { year: 1899 },
    { year: 2101 },
    { year: 2025.5 },
    { sort: 'createdById' },
  ])
    assert.throws(() => client.getArticles(query), code('INVALID_RESPONSE'));
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

test('editorial details preserve safe public content and PDF while projecting internal fields', async () => {
  let seen;
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async (url) => {
      seen = new URL(url);
      return response({
        ...article,
        createdById: 'private-user',
        status: 'PUBLISHED',
        previewToken: 'never-return',
        pdf: { ...article.pdf, storageKey: 'private-key', ownerId: 'private-user' },
        author: { ...article.author, email: 'private@example.invalid', userId: 'private-user' },
      });
    },
  });
  const result = await client.getArticle(article.slug);
  assert.equal(seen.pathname, '/api/v1/articles/conteudo-ficticio');
  assert.deepEqual(result, article);
  assert.doesNotMatch(
    JSON.stringify(result),
    /createdById|previewToken|storageKey|ownerId|userId|email/u,
  );
  assert.throws(() => client.getArticle('../admin/articles'), code('INVALID_RESPONSE'));
  await client.getArticle('filters');
  assert.equal(seen.pathname, '/api/v1/articles/filters');
});

test('editorial details remove unsafe and mismatched media and reject executable document nodes', async () => {
  for (const pdf of [
    { ...article.pdf, url: '/media/private/anexo.pdf' },
    { ...article.pdf, url: '/api/v1/admin/contacts/anexo.pdf' },
    { ...article.pdf, url: '/media/public/../private/anexo.pdf' },
    { ...article.pdf, url: '/media/public/anexo.pdf?token=private' },
    { ...article.pdf, url: 'javascript:alert(1)' },
    { ...article.pdf, mimeType: 'image/png', url: '/media/public/ficticio.png' },
  ]) {
    const client = createPublicApiClient({
      baseUrl,
      fetcher: async () => response({ ...article, pdf }),
    });
    assert.equal((await client.getArticle(article.slug)).pdf, null);
  }
  const imageMismatch = createPublicApiClient({
    baseUrl,
    fetcher: async () => response({ ...article, cover: article.pdf }),
  });
  assert.equal((await imageMismatch.getArticle(article.slug)).cover, null);
  const executable = createPublicApiClient({
    baseUrl,
    fetcher: async () =>
      response({
        ...article,
        content: { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
      }),
  });
  await assert.rejects(executable.getArticle(article.slug), code('INVALID_RESPONSE'));
  const unsafeLink = createPublicApiClient({
    baseUrl,
    fetcher: async () =>
      response({
        ...article,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Link fictício',
                  marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                },
              ],
            },
          ],
        },
      }),
  });
  assert.deepEqual((await unsafeLink.getArticle(article.slug)).content.content[0].content[0], {
    type: 'text',
    text: 'Link fictício',
  });
});

test('editorial facets preserve the whole catalog without a hidden pagination limit or internal fields', async () => {
  const tags = Array.from({ length: 2101 }, (_, index) => ({
    id: `tag-${index}`,
    slug: `tag-${index}`,
    name: `Tag fictícia ${index}`,
  }));
  const facets = { areas: [], categories: [], authors: [], tags, years: [2025, 2024] };
  let seen;
  const client = createPublicApiClient({
    baseUrl,
    fetcher: async (url) => {
      seen = new URL(url);
      return response({
        ...facets,
        internal: 'never-return',
        tags: tags.map((tag) => ({ ...tag, isMock: true })),
      });
    },
  });
  assert.deepEqual(await client.getEditorialFilters(), facets);
  assert.equal(seen.pathname, '/api/v1/editorial/filters');
  assert.equal(seen.search, '');
  for (const value of [{ ...facets, tags: null }, { ...facets, years: ['2025'] }, { areas: [] }]) {
    const invalidClient = createPublicApiClient({ baseUrl, fetcher: async () => response(value) });
    await assert.rejects(invalidClient.getEditorialFilters(), code('INVALID_RESPONSE'));
  }
});
