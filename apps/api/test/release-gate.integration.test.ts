import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { Prisma, PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaService } from '../src/database/prisma.service';
import { SearchService } from '../src/search/search.service';
import {
  inspectReleaseDatabase,
  publicReleasePaths,
  sitemapReleasePaths,
  type ReleaseDatabaseReport,
} from '../src/release/release-gate';
import { testEnvironment } from './helpers';

const production = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  MOCK_CONTENT: false,
  MOCK_INTEGRATIONS: 'false',
};
const document = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
function hasIssue(report: ReleaseDatabaseReport, code: string, resource: string) {
  return report.issues.some((issue) => issue.code === code && issue.resource === resource);
}

async function assertSitemapMatchesPublicCatalog(client: PrismaService) {
  const service = new SearchService(client, { ...testEnvironment(), APP_ENV: 'production' });
  const first = await service.sitemap({ page: 1, limit: 50 });
  const actual = first.data.map((entry) => entry.path);
  for (let page = 2; page <= first.meta.pages; page++)
    actual.push(...(await service.sitemap({ page, limit: 50 })).data.map((entry) => entry.path));
  assert.deepEqual(await sitemapReleasePaths(client), actual.sort());
}

async function withIsolatedDatabase(run: (client: PrismaService) => Promise<void>) {
  assert.equal(process.env.APP_ENV, 'development');
  assert.ok(process.env.DATABASE_URL, 'Run through the isolated PostgreSQL integration runner');
  const baseUrl = new URL(process.env.DATABASE_URL);
  const name = `filaretti_release_${randomUUID().replaceAll('-', '')}`;
  assert.match(name, /^filaretti_release_[a-f0-9]{32}$/u);
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const operator = new pg.Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
  let created = false;
  let client: PrismaService | undefined;
  try {
    await operator.connect();
    await operator.query(`CREATE DATABASE "${name}"`);
    created = true;
    const migrationClient = new pg.Client({ connectionString: url.href });
    try {
      await migrationClient.connect();
      const root = resolve(__dirname, '../../prisma/migrations');
      for (const entry of readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name)))
        await migrationClient.query(
          readFileSync(resolve(root, entry.name, 'migration.sql'), 'utf8'),
        );
    } finally {
      await migrationClient.end();
    }
    client = new PrismaService(
      testEnvironment({ DATABASE_URL: url.href, DATABASE_TIMEOUT_MS: 5000 }),
    );
    await run(client);
  } finally {
    await client?.$disconnect();
    if (created) await operator.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await operator.end();
  }
}

test('release gate rejects seeded mocks with both mock flags explicitly false', async () => {
  assert.ok(process.env.DATABASE_URL);
  const client = new PrismaService(
    testEnvironment({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_TIMEOUT_MS: 5000 }),
  );
  try {
    const report = await inspectReleaseDatabase(client, production);
    assert.equal(report.ready, false);
    for (const resource of [
      'user',
      'professional',
      'practiceArea',
      'article',
      'category',
      'tag',
      'page',
      'faq',
      'siteSetting',
      'contact',
      'newsletterSubscriber',
    ])
      assert.ok(hasIssue(report, 'MOCK_RECORD', resource), resource);
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes('@'));
    assert.ok(!serialized.includes('Local-F2'));
    assert.ok(
      report.issues.every((issue) => Object.keys(issue).sort().join(',') === 'code,count,resource'),
    );
  } finally {
    await client.$disconnect();
  }
});

test('release inspection checks completeness, hidden markers, media, redirects and bounded queries without writes', async (t) => {
  await withIsolatedDatabase(async (client) => {
    await client.siteSetting.create({ data: { siteName: '', address: {}, socialLinks: [] } });
    await t.test('a zero-mock structural database is not ready', async () => {
      const report = await inspectReleaseDatabase(client, production);
      assert.equal(report.ready, false);
      assert.ok(!report.issues.some((issue) => issue.code === 'MOCK_RECORD'));
      assert.ok(hasIssue(report, 'SITE_SETTINGS_INCOMPLETE', 'siteSetting'));
      assert.ok(hasIssue(report, 'ACTIVE_ADMIN_MISSING', 'user'));
      assert.equal(
        report.issues.filter((issue) => issue.code === 'REQUIRED_PAGE_MISSING').length,
        4,
      );
      const flags = await inspectReleaseDatabase(client, {
        MOCK_CONTENT: 'FALSE',
        MOCK_INTEGRATIONS: 0,
      });
      assert.ok(hasIssue(flags, 'ENVIRONMENT_NOT_PRODUCTION', 'APP_ENV'));
      assert.ok(hasIssue(flags, 'ENVIRONMENT_NOT_PRODUCTION', 'NODE_ENV'));
      assert.ok(hasIssue(flags, 'MOCK_FLAG_NOT_FALSE', 'MOCK_CONTENT'));
      assert.ok(hasIssue(flags, 'MOCK_FLAG_NOT_FALSE', 'MOCK_INTEGRATIONS'));
    });

    // Entirely synthetic fixture in this disposable database; no material approval or external account.
    const owner = await client.user.create({
      data: {
        email: 'gestao@release-fixture.dev',
        name: 'Responsável editorial',
        passwordHash: 'unused-in-disposable-release-fixture',
        role: 'ADMIN',
      },
    });
    await client.siteSetting.update({
      where: { id: 'site' },
      data: {
        siteName: 'Escritório de validação',
        publicEmail: 'contato@release-fixture.dev',
        publicPhone: '11999954321',
        address: { city: 'Cidade de validação' },
      },
    });
    await client.page.createMany({
      data: ['home', 'o-escritorio', 'privacidade', 'cookies'].map((slug) => ({
        slug,
        title: 'Página institucional',
        status: 'PUBLISHED' as const,
        publishedAt: new Date(0),
        sections: [
          {
            key: 'principal',
            body: document('Conteúdo institucional aprovado para validação técnica.'),
          },
        ],
      })),
    });
    const author = await client.professional.create({
      data: {
        slug: 'responsavel-editorial',
        name: 'Profissional de validação',
        title: 'Equipe editorial',
        bio: document('Biografia para validação técnica.'),
        education: [],
        experience: [],
      },
    });
    const article = await client.article.create({
      data: {
        slug: 'conteudo-editorial',
        title: 'Conteúdo editorial',
        excerpt: 'Resumo editorial',
        content: document('Conteúdo para validação técnica.'),
        authorId: author.id,
        createdById: owner.id,
        status: 'PUBLISHED',
        publishedAt: new Date(0),
      },
    });
    await t.test(
      'database/config readiness is possible with complete synthetic prerequisites',
      async () => {
        const report = await inspectReleaseDatabase(client, production);
        assert.deepEqual(report.issues, []);
        assert.equal(report.ready, true);
        assert.ok(report.checks >= 30);
        const paths = await publicReleasePaths(client);
        assert.ok(paths.includes('/conteudos/conteudo-editorial'));
        assert.ok(paths.includes('/profissionais/responsavel-editorial'));
        assert.ok(paths.includes('/privacidade'));
        assert.ok(!paths.includes('/busca'));
        const sitemap = await sitemapReleasePaths(client);
        assert.ok(sitemap.includes('/conteudos/conteudo-editorial'));
        assert.ok(sitemap.includes('/conteudos'));
        assert.ok(!sitemap.includes('/areas-de-atuacao'));
        assert.ok(!sitemap.includes('/perguntas-frequentes'));
        assert.ok(!sitemap.includes('/newsletter'));
        assert.ok(!sitemap.includes('/contato'));
        await assertSitemapMatchesPublicCatalog(client);
      },
    );

    await t.test(
      'isMock=false cannot hide mock text, account domains, media fields or editor links',
      async () => {
        const mediaIds = [randomUUID(), randomUUID(), randomUUID()];
        try {
          await client.article.update({
            where: { id: article.id },
            data: {
              content: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'Conteúdo fictício',
                        marks: [
                          { type: 'link', attrs: { href: 'https://example.invalid/arquivo' } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          });
          await client.user.update({
            where: { id: owner.id },
            data: { email: 'gestao@example.com' },
          });
          await client.media.create({
            data: {
              id: mediaIds[0],
              ownerId: owner.id,
              visibility: 'PUBLIC',
              storageKey: 'mock/placeholder.png',
              storageDriver: 'local',
              publicUrl: 'https://localhost/image.png',
              mimeType: 'image/png',
              size: 20,
              source: 'Imagem fictícia',
              license: 'placeholder',
            },
          });
          await assert.rejects(
            client.media.create({
              data: {
                id: mediaIds[2],
                ownerId: owner.id,
                visibility: 'PRIVATE',
                storageKey: 'private/exposed-rejected.pdf',
                storageDriver: 'r2',
                publicUrl: 'https://assets.release-fixture.dev/attachment.pdf',
                mimeType: 'application/pdf',
                size: 20,
              },
            }),
          );
          await client.media.create({
            data: {
              id: mediaIds[1],
              ownerId: owner.id,
              visibility: 'PRIVATE',
              storageKey: 'private/attachment.pdf',
              storageDriver: 'r2',
              publicUrl: null,
              mimeType: 'application/pdf',
              size: 20,
            },
          });
          const before = await Promise.all([
            client.article.findUnique({
              where: { id: article.id },
              select: { content: true, version: true, updatedAt: true },
            }),
            client.user.findUnique({
              where: { id: owner.id },
              select: { email: true, updatedAt: true },
            }),
            client.media.count(),
            client.auditEvent.count(),
            client.outboxTask.count(),
          ]);
          const report = await inspectReleaseDatabase(client, production);
          assert.ok(hasIssue(report, 'RELEASE_MARKER', 'article'));
          assert.ok(hasIssue(report, 'RELEASE_MARKER', 'user'));
          assert.ok(hasIssue(report, 'RELEASE_MARKER', 'media'));
          assert.ok(hasIssue(report, 'ACTIVE_ADMIN_MISSING', 'user'));
          assert.ok(hasIssue(report, 'LOCAL_MEDIA', 'media'));
          assert.ok(!hasIssue(report, 'PRIVATE_MEDIA_EXPOSED', 'media'));
          assert.ok(hasIssue(report, 'PUBLIC_IMAGE_ALT_MISSING', 'media'));
          assert.ok(!report.issues.some((issue) => issue.code === 'MOCK_RECORD'));
          assert.deepEqual(
            await Promise.all([
              client.article.findUnique({
                where: { id: article.id },
                select: { content: true, version: true, updatedAt: true },
              }),
              client.user.findUnique({
                where: { id: owner.id },
                select: { email: true, updatedAt: true },
              }),
              client.media.count(),
              client.auditEvent.count(),
              client.outboxTask.count(),
            ]),
            before,
          );
        } finally {
          await client.media.deleteMany({ where: { id: { in: mediaIds } } });
          await client.user.update({
            where: { id: owner.id },
            data: { email: 'gestao@release-fixture.dev' },
          });
          await client.article.update({
            where: { id: article.id },
            data: { content: document('Conteúdo editorial.') },
          });
        }
      },
    );

    await t.test(
      'published content requires an active author, valid date and nonempty editor sections',
      async () => {
        const [originalAuthor, originalArticle, originalPage] = await Promise.all([
          client.professional.findUniqueOrThrow({
            where: { id: author.id },
            select: { isActive: true },
          }),
          client.article.findUniqueOrThrow({
            where: { id: article.id },
            select: { content: true, publishedAt: true },
          }),
          client.page.findUniqueOrThrow({
            where: { slug: 'privacidade' },
            select: { sections: true },
          }),
        ]);
        try {
          await client.professional.update({ where: { id: author.id }, data: { isActive: false } });
          await client.article.update({
            where: { id: article.id },
            data: { content: document(' '), publishedAt: new Date(Date.now() + 3600000) },
          });
          await client.page.update({ where: { slug: 'privacidade' }, data: { sections: [] } });
          const report = await inspectReleaseDatabase(client, production);
          assert.ok(hasIssue(report, 'PUBLIC_AUTHOR_INVALID', 'article'));
          assert.ok(hasIssue(report, 'PUBLIC_CONTENT_EMPTY', 'article'));
          assert.ok(hasIssue(report, 'PUBLICATION_DATE_INVALID', 'article'));
          assert.ok(hasIssue(report, 'REQUIRED_PAGE_MISSING', 'page:privacidade'));
          const paths = await publicReleasePaths(client);
          assert.ok(!paths.includes('/conteudos/conteudo-editorial'));
          assert.ok(!paths.includes('/profissionais/responsavel-editorial'));
          await assertSitemapMatchesPublicCatalog(client);
        } finally {
          await client.professional.update({ where: { id: author.id }, data: originalAuthor });
          await client.article.update({
            where: { id: article.id },
            data: {
              content: originalArticle.content as Prisma.InputJsonValue,
              publishedAt: originalArticle.publishedAt,
            },
          });
          await client.page.update({
            where: { slug: 'privacidade' },
            data: { sections: originalPage.sections as Prisma.InputJsonValue },
          });
        }
      },
    );

    await t.test(
      'redirects validate chains, cycles, public sources and inaccessible destinations',
      async () => {
        const rows = [
          { sourcePath: '/anterior', targetPath: '/intermediario' },
          { sourcePath: '/intermediario', targetPath: '/conteudos/conteudo-editorial' },
          { sourcePath: '/ciclo-a', targetPath: '/ciclo-b' },
          { sourcePath: '/ciclo-b', targetPath: '/ciclo-a' },
          { sourcePath: '/o-escritorio', targetPath: '/contato' },
          { sourcePath: '/retirado', targetPath: '/conteudos/nao-publicado' },
          { sourcePath: '/restrito', targetPath: '/admin/destination' },
          { sourcePath: '/legado-302', targetPath: '/contato', statusCode: 302 },
          { sourcePath: '/legado-307', targetPath: '/contato', statusCode: 307 },
          { sourcePath: '/legado-308', targetPath: '/contato', statusCode: 308 },
        ].map((row) => ({ ...row, id: randomUUID() }));
        const rejectedIds = [randomUUID(), randomUUID()];
        try {
          await assert.rejects(
            client.redirect.create({
              data: {
                id: rejectedIds[0],
                sourcePath: '/externo',
                targetPath: 'https://outside.release-fixture.dev',
              },
            }),
          );
          await assert.rejects(
            client.redirect.create({
              data: {
                id: rejectedIds[1],
                sourcePath: '/status-incorreto',
                targetPath: '/contato',
                statusCode: 400,
              },
            }),
          );
          await client.redirect.createMany({ data: rows });
          const report = await inspectReleaseDatabase(client, production);
          assert.equal(report.issues.find((issue) => issue.code === 'REDIRECT_LOOP')?.count, 2);
          assert.equal(
            report.issues.find((issue) => issue.code === 'REDIRECT_SOURCE_SHADOWS_PUBLIC')?.count,
            1,
          );
          assert.equal(
            report.issues.find((issue) => issue.code === 'REDIRECT_TARGET_NOT_PUBLIC')?.count,
            2,
          );
          assert.ok(hasIssue(report, 'REDIRECT_PATH_INVALID', 'redirect'));
          assert.ok(!hasIssue(report, 'REDIRECT_STATUS_INVALID', 'redirect'));
        } finally {
          await client.redirect.deleteMany({
            where: { id: { in: [...rows.map((row) => row.id), ...rejectedIds] } },
          });
        }
      },
    );

    await t.test(
      'keyset scanner reaches records after 200 and selects no authentication secrets',
      async () => {
        const lastId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        const rows = Array.from({ length: 205 }, (_, index) => ({
          id: index === 204 ? lastId : randomUUID(),
          slug: `taxonomia-${index}`,
          name: index === 204 ? 'Placeholder' : 'Taxonomia editorial',
        }));
        try {
          await client.tag.createMany({ data: rows });
          const queries: { model: string; args: unknown }[] = [];
          const traced = client.$extends({
            query: {
              $allModels: {
                async findMany({ model, args, query }) {
                  queries.push({ model, args });
                  return query(args);
                },
              },
            },
          });
          // Prisma extensions omit the $extends member from their type but retain transaction behavior.
          const report = await inspectReleaseDatabase(
            traced as unknown as PrismaClient,
            production,
          );
          assert.equal(
            report.issues.find(
              (issue) => issue.code === 'RELEASE_MARKER' && issue.resource === 'tag',
            )?.count,
            1,
          );
          const tagQueries = queries.filter((query) => query.model === 'Tag');
          assert.equal(tagQueries.length, 2);
          for (const query of queries) {
            const args = query.args as { take: number; orderBy: unknown; select: unknown };
            assert.equal(args.take, 200);
            assert.deepEqual(args.orderBy, { id: 'asc' });
            assert.ok(args.select);
            assert.doesNotMatch(
              JSON.stringify(args.select),
              /password|secret|token|consentIpHash|requestHash/iu,
            );
          }
          const second = tagQueries[1]!.args as { where: { id: { gt: string } } };
          assert.ok(second.where.id.gt);
        } finally {
          await client.tag.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
        }
      },
    );
  });
});
