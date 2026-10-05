import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const moduleUrl = new URL('../src/lib/public-metadata.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === moduleUrl && specifier === './public-content-core')
      return nextResolve('./public-content-core.ts', context);
    if (context.parentURL === moduleUrl && specifier === 'server-only')
      return { url: 'data:text/javascript,export%20%7B%7D', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { publicMetadata } = await import(moduleUrl);
const { publicArticleSlug } = await import('../src/lib/public-routing.ts');

test('article preload accepts only bounded public detail slugs', () => {
  assert.equal(publicArticleSlug('/conteudos/publicacao-ficticia-01'), 'publicacao-ficticia-01');
  for (const path of [
    '/conteudos',
    '/conteudos/INVALID',
    '/conteudos/encoded%2Fslug',
    '/conteudos/a/b',
    '/conteudos/' + 'a'.repeat(121),
    '/conteudos/-slug',
    '/profissionais/publicacao',
    '/admin/artigos/rascunho',
    '/preview/token',
  ])
    assert.equal(publicArticleSlug(path), null, path);
});

test('metadata uses configured canonical, bounded plain strings and explicit noindex', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test';
  try {
    const metadata = publicMetadata({
      title: '<b>Título fictício</b>\n',
      description: 'a'.repeat(200),
      path: '/o-escritorio?preview=private#section',
    });
    assert.equal(metadata.title, 'Título fictício');
    assert.equal(metadata.description.length, 170);
    assert.equal(metadata.alternates.canonical, 'https://example.test/o-escritorio');
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    for (const path of ['//evil.test', 'https://evil.test', '/\\evil.test'])
      assert.equal(publicMetadata({ title: 'Título', path }).alternates, undefined);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('invalid canonical origins are omitted without exposing their configured value', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://user:secret@example.test';
  try {
    const metadata = publicMetadata({ title: 'Título', path: '/' });
    assert.equal(metadata.alternates, undefined);
    assert.equal(JSON.stringify(metadata).includes('secret'), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('indexing requires production and an explicit flag; filtered pages remain noindex and OG uses public media', () => {
  const keys = [
    'APP_ENV',
    'MOCK_CONTENT',
    'API_INTERNAL_URL',
    'NEXT_PUBLIC_SITE_URL',
    'SEO_INDEXING_ENABLED',
    'BFF_CLIENT_IP_SECRET',
    'WEB_CLIENT_IP_HEADER',
    'WEB_TRUSTED_PROXY_CONFIRMED',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    APP_ENV: 'production',
    MOCK_CONTENT: 'false',
    API_INTERNAL_URL: 'https://api.example.test',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
    SEO_INDEXING_ENABLED: 'true',
    BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
    WEB_CLIENT_IP_HEADER: 'x-real-ip',
    WEB_TRUSTED_PROXY_CONFIRMED: 'true',
  });
  try {
    const metadata = publicMetadata({
      title: 'Publicação fictícia',
      description: 'Resumo fictício',
      path: '/conteudos/exemplo',
      image: {
        id: 'ficticio',
        alt: 'Imagem fictícia',
        url: '/media/public/exemplo.webp',
        mimeType: 'image/webp',
        size: 100,
      },
      article: { publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    });
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.openGraph.type, 'article');
    assert.equal(metadata.openGraph.url, 'https://example.test/conteudos/exemplo');
    assert.equal(
      metadata.openGraph.images[0].url,
      'https://example.test/media/public/exemplo.webp',
    );
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.deepEqual(
      publicMetadata({ title: 'Filtros', path: '/conteudos', noIndex: true }).robots,
      { index: false, follow: false },
    );
    process.env.SEO_INDEXING_ENABLED = 'false';
    assert.equal(publicMetadata({ title: 'Página', path: '/' }).robots.index, false);
    process.env.SEO_INDEXING_ENABLED = 'true';
    for (const appEnv of ['development', 'staging']) {
      process.env.APP_ENV = appEnv;
      assert.equal(publicMetadata({ title: 'Página', path: '/' }).robots.index, false);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
