import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(
  readFileSync(new URL('../src/lib/article-complements.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { loadArticleComplements } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const article = {
  id: 'current-fictitious',
  practiceAreas: [{ slug: 'area-ficticia' }],
  author: { slug: 'autor-ficticio' },
};

test('complementary reads start concurrently and keep at most three other publications', async () => {
  const calls = [];
  let finishArticles;
  let finishAuthor;
  const result = loadArticleComplements(article, {
    articles: (area) => {
      calls.push(['articles', area]);
      return new Promise((done) => {
        finishArticles = done;
      });
    },
    professional: (slug) => {
      calls.push(['professional', slug]);
      return new Promise((done) => {
        finishAuthor = done;
      });
    },
  });
  assert.deepEqual(calls, [
    ['articles', 'area-ficticia'],
    ['professional', 'autor-ficticio'],
  ]);
  finishArticles([
    { id: article.id },
    { id: 'one' },
    { id: 'two' },
    { id: 'three' },
    { id: 'four' },
  ]);
  const author = { slug: 'autor-ficticio', name: 'Autor fictício' };
  finishAuthor(author);
  assert.deepEqual(await result, {
    related: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
    author,
    relatedUnavailable: false,
  });
});

test('unavailable author data does not discard related publications or expose diagnostics', async () => {
  const result = await loadArticleComplements(article, {
    articles: async () => [{ id: 'another-fictitious' }],
    professional: async () => {
      throw new Error('fictitious-private-diagnostic');
    },
  });
  assert.equal(result.author, null);
  assert.deepEqual(result.related, [{ id: 'another-fictitious' }]);
  assert.equal(result.relatedUnavailable, false);
  assert.ok(!JSON.stringify(result).includes('fictitious-private-diagnostic'));
});

test('unavailable related publications retain the public author and an explicit failure state', async () => {
  const author = { slug: 'autor-ficticio', name: 'Autor fictício' };
  const result = await loadArticleComplements(article, {
    articles: async () => {
      throw new Error('fictitious-private-diagnostic');
    },
    professional: async () => author,
  });
  assert.deepEqual(result.related, []);
  assert.equal(result.author, author);
  assert.equal(result.relatedUnavailable, true);
  assert.ok(!JSON.stringify(result).includes('fictitious-private-diagnostic'));
});
