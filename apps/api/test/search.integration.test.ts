import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PaginatedResponse, PublicSearchResult, PublicSitemapEntry } from '@filaretti/types';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { SearchService } from '../src/search/search.service';
import { testEnvironment } from './helpers';

test('Portuguese search and public sitemap enforce publication in real PostgreSQL and HTTP', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'Use the isolated integration database runner.');
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
  });
  const app = await createApplication(environment, new SanitizedLogger(() => undefined));
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const prefix = `fts-${randomUUID()}`;
  const term = `jurif${randomUUID().replaceAll('-', '')}`;
  const doc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const actor = await db.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      name: 'Pessoa fictícia',
      role: 'ADMIN',
      passwordHash: 'unusable-fictitious-fixture',
      isMock: true,
    },
  });
  const person = await db.professional.create({
    data: {
      slug: `${prefix}-person`,
      name: `${term} Profissional fictício`,
      title: 'Perfil fictício',
      bio: doc('Biografia fictícia'),
      education: [],
      experience: [],
      isMock: true,
    },
  });
  const area = await db.practiceArea.create({
    data: {
      slug: `${prefix}-area`,
      name: `${term} Área fictícia`,
      summary: 'Resumo fictício',
      description: doc('Descrição fictícia'),
      services: [],
      isMock: true,
    },
  });
  const articleInput = {
    authorId: person.id,
    createdById: actor.id,
    excerpt: 'Resumo fictício',
    isMock: true,
  };
  const title = await db.article.create({
    data: {
      ...articleInput,
      slug: `${prefix}-title`,
      title: `${term} responsabilidade`,
      content: doc('Texto fictício'),
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 10000),
    },
  });
  const body = await db.article.create({
    data: {
      ...articleInput,
      slug: `${prefix}-body`,
      title: 'Texto fictício',
      content: doc(`${term} responsabilidade`),
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 10000),
    },
  });
  await db.article.create({
    data: {
      ...articleInput,
      slug: `${prefix}-draft`,
      title: term,
      content: doc(term),
      status: 'DRAFT',
    },
  });
  await db.article.create({
    data: {
      ...articleInput,
      slug: `${prefix}-future`,
      title: term,
      content: doc(term),
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() + 86400000),
    },
  });
  await db.article.create({
    data: {
      ...articleInput,
      slug: `${prefix}-scheduled`,
      title: term,
      content: doc(term),
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 86400000),
    },
  });
  const base = await app.getUrl();
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${base}/api/v1/public${path}`);
    assert.equal(response.status, 200);
    return (await response.json()) as T;
  }
  try {
    await t.test(
      'ranking prioritizes title, Portuguese inflections match and rows are projected',
      async () => {
        const results = await get<PaginatedResponse<PublicSearchResult>>(
          `/search?q=${term}%20responsabilidades&kind=article`,
        );
        assert.equal(results.meta.total, 2);
        assert.deepEqual(
          results.data.map((row) => row.slug),
          [title.slug, body.slug],
        );
        assert.deepEqual(Object.keys(results.data[0]!).sort(), [
          'excerpt',
          'href',
          'kind',
          'slug',
          'title',
        ]);
      },
    );
    await t.test(
      'filters and stable pagination exclude drafts, schedules and future publication',
      async () => {
        const first = await get<PaginatedResponse<PublicSearchResult>>(`/search?q=${term}&limit=2`);
        const second = await get<PaginatedResponse<PublicSearchResult>>(
          `/search?q=${term}&limit=2&page=2`,
        );
        assert.equal(first.meta.total, 4);
        assert.equal(first.meta.pages, 2);
        assert.equal(new Set([...first.data, ...second.data].map((row) => row.href)).size, 4);
        const areas = await get<PaginatedResponse<PublicSearchResult>>(
          `/search?q=${term}&kind=area`,
        );
        assert.deepEqual(
          areas.data.map((row) => row.slug),
          [area.slug],
        );
        const stopwords = await get<PaginatedResponse<PublicSearchResult>>('/search?q=de');
        assert.equal(stopwords.meta.total, 0);
        const injection = await get<PaginatedResponse<PublicSearchResult>>(
          `/search?q=${encodeURIComponent("'; DROP TABLE articles; --")}`,
        );
        assert.ok(Array.isArray(injection.data));
        for (const path of [
          '/search?q=x',
          `/search?q=${term}&limit=51`,
          `/search?q=${term}&kind=private`,
          `/search?q=${term}&unexpected=1`,
        ])
          assert.equal((await fetch(`${base}/api/v1/public${path}`)).status, 400);
      },
    );
    await t.test('sitemap contains only public paths and production excludes mocks', async () => {
      const first = await get<PaginatedResponse<PublicSitemapEntry>>('/sitemap?limit=50');
      const entries = [...first.data];
      for (let page = 2; page <= first.meta.pages; page++)
        entries.push(
          ...(await get<PaginatedResponse<PublicSitemapEntry>>(`/sitemap?limit=50&page=${page}`))
            .data,
        );
      assert.ok(entries.some((row) => row.path === `/conteudos/${title.slug}`));
      assert.equal(
        entries.some(
          (row) =>
            row.path.endsWith(`${prefix}-draft`) ||
            row.path.endsWith(`${prefix}-future`) ||
            row.path.endsWith(`${prefix}-scheduled`),
        ),
        false,
      );
      assert.equal(
        entries.some((row) => /^\/(?:admin|preview|api|busca)/u.test(row.path)),
        false,
      );
      const production = new SearchService(db, {
        ...environment,
        APP_ENV: 'production',
        MOCK_CONTENT: false,
      });
      const productionEntries = await production.sitemap({ page: 1, limit: 50 });
      assert.equal(
        (await production.search({ q: term, kind: 'all', page: 1, limit: 50 })).meta.total,
        0,
      );
      await db.article.update({ where: { id: title.id }, data: { isMock: false } });
      assert.equal(
        (await production.search({ q: term, kind: 'article', page: 1, limit: 50 })).meta.total,
        0,
        'A real article with a mock author remains excluded',
      );
      await db.professional.update({ where: { id: person.id }, data: { isMock: false } });
      assert.equal(
        (await production.search({ q: term, kind: 'article', page: 1, limit: 50 })).meta.total,
        1,
      );
      await db.article.update({ where: { id: title.id }, data: { isMock: true } });
      await db.professional.update({ where: { id: person.id }, data: { isMock: true } });
      const productionRows = [...productionEntries.data];
      for (let page = 2; page <= productionEntries.meta.pages; page++)
        productionRows.push(...(await production.sitemap({ page, limit: 50 })).data);
      assert.equal(
        productionRows.some((row) => row.path.includes(prefix)),
        false,
      );
    });
    await t.test(
      'withdrawal and inactive author immediately revoke search and sitemap visibility',
      async () => {
        await db.article.update({ where: { id: body.id }, data: { status: 'DRAFT' } });
        assert.equal(
          (await get<PaginatedResponse<PublicSearchResult>>(`/search?q=${term}&kind=article`)).meta
            .total,
          1,
        );
        await db.professional.update({ where: { id: person.id }, data: { isActive: false } });
        assert.equal(
          (await get<PaginatedResponse<PublicSearchResult>>(`/search?q=${term}`)).meta.total,
          1,
        );
        const all = await app.get(SearchService).sitemap({ page: 1, limit: 50 });
        const rows = [...all.data];
        for (let page = 2; page <= all.meta.pages; page++)
          rows.push(...(await app.get(SearchService).sitemap({ page, limit: 50 })).data);
        assert.equal(
          rows.some(
            (row) =>
              row.path === `/conteudos/${title.slug}` ||
              row.path === `/profissionais/${person.slug}`,
          ),
          false,
        );
      },
    );
  } finally {
    await db.article.deleteMany({ where: { createdById: actor.id } });
    await db.professional.delete({ where: { id: person.id } });
    await db.practiceArea.delete({ where: { id: area.id } });
    await db.user.delete({ where: { id: actor.id } });
    await app.close();
  }
});
