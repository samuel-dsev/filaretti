import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const queryUrl = new URL('../src/lib/editorial-query.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === queryUrl && specifier === './public-routing')
      return nextResolve('./public-routing.ts', context);
    return nextResolve(specifier, context);
  },
});
const { parseEditorialQuery, editorialHref } = await import(queryUrl);

test('shared filter links round-trip every combined criterion and preserve filters across pages', () => {
  const query = parseEditorialQuery({
    pagina: '3',
    area: 'area-ficticia',
    categoria: 'categoria-ficticia',
    autor: 'profissional-ficticio',
    tag: 'tag-ficticia',
    tipo: 'GUIDE',
    ano: '2026',
    ordem: 'oldest',
  });
  assert.equal(query.page, 3);
  assert.equal(query.year, 2026);
  const url = new URL(editorialHref(query, 4), 'https://example.test');
  assert.equal(url.pathname, '/conteudos');
  assert.equal(url.searchParams.get('pagina'), '4');
  assert.deepEqual(parseEditorialQuery(Object.fromEntries(url.searchParams)), {
    ...query,
    page: 4,
  });
  assert.equal(new URL(editorialHref(query, 1), url).searchParams.has('pagina'), false);
});

test('invalid, duplicated and unrelated query values are bounded before reaching the API', () => {
  const query = parseEditorialQuery({
    pagina: '100001',
    area: '../admin',
    categoria: ['um', 'dois'],
    autor: 'a'.repeat(121),
    tag: 'javascript:alert(1)',
    tipo: 'DRAFT',
    ano: '2101',
    ordem: 'secret',
    token: 'private',
  });
  assert.equal(editorialHref(query), '/conteudos');
  for (const year of ['1899', '1e3', ['2025', '2026'], '2026.0'])
    assert.equal(parseEditorialQuery({ ano: year }).year, undefined);
  assert.equal(parseEditorialQuery({ ano: '2100' }).year, 2100);
  assert.equal(parseEditorialQuery({ pagina: '100000' }).page, 100000);
});
