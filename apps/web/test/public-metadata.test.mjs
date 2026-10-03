import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const moduleUrl = new URL('../src/lib/public-metadata.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === moduleUrl && specifier === 'server-only')
      return { url: 'data:text/javascript,export%20%7B%7D', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { publicMetadata } = await import(moduleUrl);

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
