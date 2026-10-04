import assert from 'node:assert/strict';
import test from 'node:test';
import { publicRedirectPath, previewTokenPath, isPrivateCmsPath } from '../src/lib/cms-routing.ts';

test('CMS routing rejects external, encoded and private redirect destinations', () => {
  for (const path of ['/', '/conteudos/artigo', '/areas-de-atuacao/area', '/old.html']) {
    assert.equal(publicRedirectPath(path), true);
  }
  for (const path of [
    null,
    '//example.test',
    'https://example.test',
    '/admin',
    '/preview/token',
    '/api/v1/users',
    '/_next/data',
    '/media/public/x',
    '/dev/design-system',
    '/a/../b',
    '/a%2fb',
    '/a?token=x',
    '/a#fragment',
    '/a/',
    '/a\\b',
    '/' + 'a'.repeat(501),
  ]) {
    assert.equal(publicRedirectPath(path), false);
  }
});

test('preview routing requires a bounded opaque token and marks private surfaces', () => {
  assert.equal(previewTokenPath('/preview/' + 'a'.repeat(43)), 'a'.repeat(43));
  for (const path of ['/preview/x', '/preview/' + 'a'.repeat(44), '/preview/%2f', '/preview/a/b']) {
    assert.equal(previewTokenPath(path), null);
  }
  assert.equal(isPrivateCmsPath('/admin/artigos'), true);
  assert.equal(isPrivateCmsPath('/preview/token'), true);
  assert.equal(isPrivateCmsPath('/administracao'), false);
});
