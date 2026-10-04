import assert from 'node:assert/strict';
import test from 'node:test';
import { publicRouteResource, publicPageNumber } from '../src/lib/public-routing.ts';
import { isManagedPublicMedia, publicImage, publicPdf } from '../src/lib/public-media.ts';
import { publicStatusHtml } from '../src/lib/public-status.ts';

test('status gate restricts backend requests to known public resources and slugs', () => {
  assert.deepEqual(publicRouteResource('/areas-de-atuacao/area-ficticia-1'), {
    endpoint: '/practice-areas/area-ficticia-1',
    isDetail: true,
  });
  assert.equal(publicRouteResource('/api/v1/admin/users'), null);
  for (const path of [
    '/profissionais/%2e%2e',
    '/profissionais/segredo?token=1',
    '/profissionais/' + 'a'.repeat(121),
  ]) {
    assert.equal(publicRouteResource(path).endpoint, '');
  }
  assert.equal(publicRouteResource('/areas-de-atuacao').isDetail, false);
  assert.deepEqual(publicRouteResource('/conteudos'), {
    endpoint: '/articles?limit=1',
    isDetail: false,
  });
  assert.deepEqual(publicRouteResource('/conteudos/artigo-ficticio'), {
    endpoint: '/articles/artigo-ficticio',
    isDetail: true,
  });
  assert.equal(publicRouteResource('/conteudos/%2e%2e').endpoint, '');
});

test('guide PDF allowlist rejects private paths, remote origins, incorrect MIME and unsafe sizes', () => {
  const pdf = {
    id: 'fixture',
    alt: null,
    size: 2048,
    mimeType: 'application/pdf',
    url: '/media/public/guia-ficticio.pdf',
  };
  assert.deepEqual(publicPdf(pdf), { href: pdf.url, sizeLabel: '2 KB' });
  for (const url of [
    '/media/private/guia.pdf',
    '/api/v1/admin/contacts/file.pdf',
    'https://example.test/guia.pdf',
    '//example.test/file.pdf',
    '/media/public/a.pdf?token=secret',
    '/media/public/a%2fb.pdf',
    '/media/public/../private/a.pdf',
    '/media/public/a.pdf.html',
  ])
    assert.equal(publicPdf({ ...pdf, url }), undefined);
  for (const size of [0, -1, 0.5, 10 * 1024 * 1024 + 1, Number.NaN])
    assert.equal(publicPdf({ ...pdf, size }), undefined);
  assert.equal(publicPdf({ ...pdf, mimeType: 'text/html' }), undefined);
});

test('invalid pagination is bounded without forwarding arbitrary query values', () => {
  for (const value of [undefined, ['1', '2'], '0', '-1', '1e3', '100001', 'javascript:x'])
    assert.equal(publicPageNumber(value), 1);
  assert.equal(publicPageNumber('100000'), 100000);
});

test('image allowlist excludes executable, external, private and ambiguous assets', () => {
  const media = {
    id: 'fixture',
    alt: 'Ilustração fictícia',
    size: 1234,
    mimeType: 'image/png',
    url: '/media/public/fixture.png',
  };
  assert.deepEqual(publicImage(media), { src: media.url, alt: media.alt });
  for (const url of [
    'https://example.test/photo.png',
    '/api/v1/admin/photo.png',
    '//example.test/photo.png',
    '/media/public/../private.png',
    '/media/public/fixture.png?token=abc',
    '/media/public/a%2fb.png',
    '/media/public/a.svg',
    '/media/public/a\\b.png',
  ])
    assert.equal(publicImage({ ...media, url }), undefined);
  assert.equal(publicImage({ ...media, mimeType: 'image/svg+xml' }), undefined);
});

test('revocable CMS media bypasses image caching while static fixtures remain optimizable', () => {
  const key = '11111111-2222-4333-8444-555555555555';
  for (const extension of ['jpg', 'png', 'webp', 'avif', 'pdf'])
    assert.equal(isManagedPublicMedia(`/media/public/${key}.${extension}`), true);
  for (const path of [
    '/media/public/fixture.png',
    `/media/private/${key}.png`,
    `https://fixture.invalid/media/public/${key}.png`,
    `/media/public/${key}.svg`,
  ])
    assert.equal(isManagedPublicMedia(path), false);
});

test('status pages provide accessible navigation and noindex without backend diagnostics', () => {
  for (const status of [404, 503]) {
    const html = publicStatusHtml(status);
    assert.match(html, /<main id="conteudo"/);
    assert.match(html, /noindex,nofollow/);
    assert.doesNotMatch(html, /API_INTERNAL_URL|postgres|stack|token/i);
  }
});
