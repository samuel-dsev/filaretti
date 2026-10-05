import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaService } from '../src/database/prisma.service';
import {
  MigrationFailure,
  parseMigrationBatch,
  type MigrationKind,
  type MigrationUrl,
} from '../src/release/migration-contract';
import {
  migrateBatch,
  verifyImportedBatch,
  type MigrationOptions,
} from '../src/release/migration-importer';
import { testEnvironment } from './helpers';

interface FixtureRecord {
  kind: MigrationKind;
  id: string;
  data: Record<string, unknown>;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
}
interface FixtureBatch {
  schemaVersion: 1;
  batchId: string;
  fixture: true;
  legacyOrigin: string;
  approval: null;
  records: FixtureRecord[];
  urls: MigrationUrl[];
}
const content = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Conteúdo fictício para o ensaio isolado da migração F9.' }],
    },
  ],
};
function hasIssue(code: string) {
  return (error: unknown) =>
    error instanceof MigrationFailure && error.issues.some((issue) => issue.code === code);
}
function record(batch: FixtureBatch, kind: MigrationKind): FixtureRecord {
  const value = batch.records.find((item) => item.kind === kind);
  assert.ok(value, `Fixture must include ${kind}.`);
  return value;
}

test('F9 migration validates isolated fixtures and commits an idempotent atomic batch in PostgreSQL', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'Use the isolated PostgreSQL integration runner.');
  const databaseName = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
  assert.match(databaseName, /^filaretti_test_[a-f0-9]{32}$/u);
  const environment = {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    MOCK_CONTENT: 'true',
    DATABASE_URL: process.env.DATABASE_URL,
  };
  const db = new PrismaService(
    testEnvironment({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_TIMEOUT_MS: 5000 }),
  );
  const batchIds = new Set<string>();
  const ids = new Set<string>();
  const redirectPaths = new Set<string>();
  const mediaIds = new Set<string>();
  const userIds = new Set<string>();
  const admin = await db.user.findUniqueOrThrow({ where: { email: 'admin@filaretti.test' } });
  const author = await db.user.findUniqueOrThrow({ where: { email: 'author@filaretti.test' } });
  assert.equal(admin.role, 'ADMIN');
  assert.equal(admin.isActive, true);

  function fixture(full = false): FixtureBatch {
    const batchId = randomUUID();
    const suffix = randomUUID();
    const categoryId = randomUUID();
    const batch: FixtureBatch = {
      schemaVersion: 1,
      batchId,
      fixture: true,
      legacyOrigin: 'https://legacy.example.invalid',
      approval: null,
      records: [
        {
          kind: 'category',
          id: categoryId,
          data: { slug: `f9-${suffix}-categoria`, name: 'Categoria fictícia F9', isActive: true },
        },
      ],
      urls: [],
    };
    batchIds.add(batchId);
    if (full) {
      const tagId = randomUUID();
      const areaId = randomUUID();
      const professionalId = randomUUID();
      const articleId = randomUUID();
      const faqId = randomUUID();
      // Relationships point forward in the input; import order must honor the actual dependencies.
      batch.records.unshift(
        {
          kind: 'article',
          id: articleId,
          status: 'PUBLISHED',
          publishedAt: new Date(Date.now() - 60_000).toISOString(),
          data: {
            slug: `f9-${suffix}-artigo`,
            title: 'Artigo fictício F9',
            excerpt: 'Resumo fictício para integração isolada.',
            type: 'ARTICLE',
            content,
            authorId: professionalId,
            categoryIds: [categoryId],
            tagIds: [tagId],
            practiceAreaIds: [areaId],
          },
        },
        {
          kind: 'faq',
          id: faqId,
          data: { question: 'Pergunta fictícia F9?', answer: content, practiceAreaId: areaId },
        },
        {
          kind: 'professional',
          id: professionalId,
          data: {
            slug: `f9-${suffix}-profissional`,
            name: 'Profissional fictício F9',
            title: 'Perfil exclusivamente fictício',
            bio: content,
            education: ['Formação fictícia'],
            experience: ['Experiência fictícia'],
            practiceAreaIds: [areaId],
            isActive: true,
          },
        },
        {
          kind: 'practiceArea',
          id: areaId,
          data: {
            slug: `f9-${suffix}-area`,
            name: 'Área fictícia F9',
            summary: 'Resumo fictício da área.',
            description: content,
            services: ['Serviço fictício'],
            isActive: true,
          },
        },
        {
          kind: 'tag',
          id: tagId,
          data: { slug: `f9-${suffix}-tag`, name: 'Tag fictícia F9', isActive: true },
        },
      );
      const articlePath = `/conteudos/${String(record(batch, 'article').data.slug)}`;
      batch.urls.push(
        {
          sourcePath: `/legado-ficticio-${suffix}`,
          decision: 'redirect',
          targetPath: articlePath,
          removalApproval: null,
          title: 'Título fictício antigo',
          description: 'Descrição fictícia do inventário.',
          assetPaths: ['/arquivos/guia-ficticio.pdf'],
        },
        {
          sourcePath: articlePath,
          decision: 'keep',
          targetPath: articlePath,
          removalApproval: null,
          title: 'Artigo fictício preservado',
          description: '',
          assetPaths: [],
        },
        {
          sourcePath: `/retirada-ficticia-${suffix}`,
          decision: 'remove',
          targetPath: null,
          removalApproval: 'fixture/removal-reference',
          title: 'Retirada fictícia auditada',
          description: '',
          assetPaths: [],
        },
      );
    }
    for (const item of batch.records) ids.add(item.id);
    for (const url of batch.urls) redirectPaths.add(url.sourcePath);
    return batch;
  }
  function options(batch: ReturnType<typeof parseMigrationBatch>): MigrationOptions {
    return {
      actorId: admin.id,
      apply: true,
      confirmSha256: batch.sha256,
      confirmDatabase: databaseName,
      environment,
    };
  }
  async function counts() {
    const values = await Promise.all([
      db.category.count(),
      db.tag.count(),
      db.practiceArea.count(),
      db.professional.count(),
      db.article.count(),
      db.page.count(),
      db.faq.count(),
      db.auditEvent.count(),
      db.redirect.count(),
      db.user.count(),
      db.contact.count(),
      db.newsletterSubscriber.count(),
      db.media.count(),
      db.outboxTask.count(),
    ]);
    return values;
  }
  async function rejectWithoutWrites(input: FixtureBatch, code: string) {
    const batch = parseMigrationBatch(input);
    const before = await counts();
    await assert.rejects(migrateBatch(db, batch, options(batch)), hasIssue(code));
    assert.deepEqual(await counts(), before);
    assert.equal(
      await db.auditEvent.count({
        where: { action: 'migration.imported', resourceId: batch.batchId },
      }),
      0,
    );
  }
  const imported = fixture(true);

  try {
    await t.test(
      'dry-run performs no writes, including receipt/audit or operational data',
      async () => {
        const batch = parseMigrationBatch(imported);
        const before = await counts();
        const report = await migrateBatch(db, batch, { actorId: admin.id, environment });
        assert.equal(report.mode, 'dry-run');
        assert.equal(report.records, 6);
        assert.equal(report.redirects, 1);
        assert.equal(report.skipped, false);
        assert.deepEqual(report.issues, []);
        assert.deepEqual(await counts(), before);
        assert.deepEqual(await verifyImportedBatch(db, batch), {
          ready: false,
          code: 'IMPORT_RECEIPT_UNVERIFIED',
        });
        assert.deepEqual(await counts(), before);
        assert.doesNotMatch(JSON.stringify(report), /postgresql:|password|Conteúdo fictício/u);
      },
    );

    await t.test(
      'application persists relationships, publication and only the approved fixture domain',
      async () => {
        const batch = parseMigrationBatch(imported);
        const before = await counts();
        const report = await migrateBatch(db, batch, options(batch));
        assert.equal(report.mode, 'apply');
        assert.equal(report.skipped, false);
        const after = await counts();
        assert.deepEqual(
          after.map((value, index) => value - before[index]!),
          [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0],
        );
        const article = await db.article.findUniqueOrThrow({
          where: { id: record(imported, 'article').id },
          include: { categories: true, tags: true, practiceAreas: true },
        });
        assert.equal(article.authorId, record(imported, 'professional').id);
        assert.equal(article.createdById, admin.id);
        assert.equal(article.updatedById, admin.id);
        assert.equal(article.isMock, true);
        assert.equal(article.status, 'PUBLISHED');
        assert.equal(article.publishedAt?.toISOString(), record(imported, 'article').publishedAt);
        assert.deepEqual(
          article.categories.map((row) => row.categoryId),
          [record(imported, 'category').id],
        );
        assert.deepEqual(
          article.tags.map((row) => row.tagId),
          [record(imported, 'tag').id],
        );
        assert.deepEqual(
          article.practiceAreas.map((row) => row.practiceAreaId),
          [record(imported, 'practiceArea').id],
        );
        const professional = await db.professional.findUniqueOrThrow({
          where: { id: record(imported, 'professional').id },
          include: { practiceAreas: true },
        });
        assert.deepEqual(
          professional.practiceAreas.map((row) => row.practiceAreaId),
          [record(imported, 'practiceArea').id],
        );
        const faq = await db.faq.findUniqueOrThrow({ where: { id: record(imported, 'faq').id } });
        assert.equal(faq.practiceAreaId, record(imported, 'practiceArea').id);
        const redirect = await db.redirect.findUniqueOrThrow({
          where: { sourcePath: imported.urls[0]!.sourcePath },
        });
        assert.equal(redirect.targetPath, imported.urls[0]!.targetPath);
        assert.equal(redirect.statusCode, 301);
        assert.equal(
          await db.redirect.count({ where: { sourcePath: imported.urls[2]!.sourcePath } }),
          0,
        );
        const receipt = await db.auditEvent.findFirstOrThrow({
          where: { action: 'migration.imported', resourceId: batch.batchId },
        });
        assert.equal((receipt.metadata as { sha256: string }).sha256, batch.sha256);
        assert.deepEqual(await verifyImportedBatch(db, batch), { ready: true, code: null });
        assert.deepEqual(await counts(), after);
      },
    );

    await t.test(
      'snapshot verifies publication dates and restores only the owned fixture',
      async () => {
        const batch = parseMigrationBatch(imported);
        const article = await db.article.findUniqueOrThrow({
          where: { id: record(imported, 'article').id },
        });
        assert.ok(article.publishedAt);
        try {
          await db.article.update({
            where: { id: article.id },
            data: {
              publishedAt: new Date(article.publishedAt.getTime() - 1000),
              updatedAt: article.updatedAt,
            },
          });
          assert.deepEqual(await verifyImportedBatch(db, batch), {
            ready: false,
            code: 'IMPORTED_BATCH_DRIFT',
          });
        } finally {
          await db.article.update({
            where: { id: article.id },
            data: { publishedAt: article.publishedAt, updatedAt: article.updatedAt },
          });
        }
        assert.deepEqual(await verifyImportedBatch(db, batch), { ready: true, code: null });
      },
    );

    await t.test(
      'replay preserves CMS edits and keeps a drifted snapshot blocked, while changed digest conflicts',
      async () => {
        const articleId = record(imported, 'article').id;
        await db.article.update({
          where: { id: articleId },
          data: { title: 'Edição fictícia posterior do CMS', version: { increment: 1 } },
        });
        const batch = parseMigrationBatch(imported);
        const before = await counts();
        assert.deepEqual(await verifyImportedBatch(db, batch), {
          ready: false,
          code: 'IMPORTED_BATCH_DRIFT',
        });
        const report = await migrateBatch(db, batch, options(batch));
        assert.equal(report.skipped, true);
        assert.deepEqual(await counts(), before);
        assert.deepEqual(await verifyImportedBatch(db, batch), {
          ready: false,
          code: 'IMPORTED_BATCH_DRIFT',
        });
        const article = await db.article.findUniqueOrThrow({ where: { id: articleId } });
        assert.equal(article.title, 'Edição fictícia posterior do CMS');
        assert.equal(article.version, 2);
        const changed = structuredClone(imported);
        record(changed, 'article').data.title = 'Tentativa fictícia de alteração do lote';
        const conflict = parseMigrationBatch(changed);
        await assert.rejects(
          migrateBatch(db, conflict, options(conflict)),
          hasIssue('BATCH_DIGEST_CONFLICT'),
        );
        assert.deepEqual(await counts(), before);
        assert.equal((await db.article.findUniqueOrThrow({ where: { id: articleId } })).version, 2);
      },
    );

    await t.test(
      'slugs, editor payloads and internal/unknown data are rejected before persistence',
      () => {
        const mutations: ((input: FixtureBatch) => void)[] = [
          (input) => {
            record(input, 'category').data.slug = 'Slug Inválido';
          },
          (input) => {
            record(input, 'category').data.isMock = false;
          },
          (input) => {
            record(input, 'category').data.user = { password: 'overposted-fixture' };
          },
          (input) => {
            record(input, 'article').data.content = {
              type: 'doc',
              content: [{ type: 'script', text: 'alert(1)' }],
            };
          },
          (input) => {
            record(input, 'article').data.content = {
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
            };
          },
        ];
        for (const mutate of mutations) {
          const input = fixture(true);
          mutate(input);
          assert.throws(() => parseMigrationBatch(input), hasIssue('INVALID_RECORD'));
        }
        const unsupported = fixture();
        assert.throws(
          () => parseMigrationBatch({ ...unsupported, users: [] }),
          hasIssue('INVALID_BATCH'),
        );
      },
    );

    await t.test(
      'missing or inactive relationships and missing/private media prevent the whole batch',
      async () => {
        const missingRelation = fixture(true);
        record(missingRelation, 'article').data.authorId = randomUUID();
        await rejectWithoutWrites(missingRelation, 'INVALID_RELATION');
        const inactive = fixture(true);
        record(inactive, 'practiceArea').data.isActive = false;
        await rejectWithoutWrites(inactive, 'INVALID_RELATION');
        const missingMedia = fixture(true);
        record(missingMedia, 'article').data.coverMediaId = randomUUID();
        await rejectWithoutWrites(missingMedia, 'INVALID_MEDIA');
        const privateId = randomUUID();
        mediaIds.add(privateId);
        await db.media.create({
          data: {
            id: privateId,
            ownerId: admin.id,
            visibility: 'PRIVATE',
            storageKey: `${randomUUID()}.png`,
            publicUrl: null,
            mimeType: 'image/png',
            size: 1,
            isMock: true,
          },
        });
        const privateMedia = fixture(true);
        record(privateMedia, 'professional').data.photoMediaId = privateId;
        await rejectWithoutWrites(privateMedia, 'INVALID_MEDIA');
      },
    );

    await t.test(
      'cycles, missing destinations and redirects shadowing current routes fail closed',
      async () => {
        const cycle = fixture(true);
        const a = `/f9-cycle-${randomUUID()}`;
        const b = `/f9-cycle-${randomUUID()}`;
        const map = (sourcePath: string, targetPath: string): MigrationUrl => ({
          sourcePath,
          targetPath,
          decision: 'redirect',
          removalApproval: null,
          title: 'URL fictícia',
          description: '',
          assetPaths: [],
        });
        cycle.urls = [map(a, b), map(b, a)];
        assert.throws(() => parseMigrationBatch(cycle), hasIssue('REDIRECT_LOOP'));
        const missing = fixture();
        const missingSource = `/f9-old-${randomUUID()}`;
        redirectPaths.add(missingSource);
        missing.urls = [map(missingSource, `/conteudos/f9-missing-${randomUUID()}`)];
        await rejectWithoutWrites(missing, 'REDIRECT_TARGET_MISSING');
        const shadow = fixture();
        shadow.urls = [
          map(`/conteudos/${String(record(imported, 'article').data.slug)}`, '/conteudos'),
        ];
        await rejectWithoutWrites(shadow, 'REDIRECT_SHADOWS_PUBLIC_ROUTE');
        const areaShadow = fixture();
        areaShadow.urls = [
          map(
            `/areas-de-atuacao/${String(record(imported, 'practiceArea').data.slug)}`,
            '/areas-de-atuacao',
          ),
        ];
        await rejectWithoutWrites(areaShadow, 'REDIRECT_SHADOWS_PUBLIC_ROUTE');
        const reserved = fixture(true);
        const reservedPath = `/conteudos/${String(record(reserved, 'article').data.slug)}`;
        redirectPaths.add(reservedPath);
        await db.redirect.create({ data: { sourcePath: reservedPath, targetPath: '/conteudos' } });
        await rejectWithoutWrites(reserved, 'SLUG_RESERVED');
        const combined = fixture();
        const existingSource = `/f9-existing-${randomUUID()}`;
        const newSource = `/f9-new-${randomUUID()}`;
        redirectPaths.add(existingSource);
        redirectPaths.add(newSource);
        await db.redirect.create({ data: { sourcePath: existingSource, targetPath: newSource } });
        combined.urls = [map(newSource, existingSource)];
        await rejectWithoutWrites(combined, 'REDIRECT_LOOP');
      },
    );

    await t.test(
      'preexisting CMS records, institutional pages and populated settings are preserved',
      async () => {
        const collision = fixture();
        const current = await db.category.create({
          data: {
            id: randomUUID(),
            slug: String(record(collision, 'category').data.slug),
            name: 'Categoria fictícia existente no CMS',
            isMock: true,
          },
        });
        ids.add(current.id);
        await rejectWithoutWrites(collision, 'DESTINATION_CONFLICT');
        assert.deepEqual(
          await db.category.findUniqueOrThrow({ where: { id: current.id } }),
          current,
        );
        const pageBatch = fixture();
        const pageId = randomUUID();
        ids.add(pageId);
        pageBatch.records.push({
          kind: 'page',
          id: pageId,
          status: 'PUBLISHED',
          publishedAt: new Date(Date.now() - 60_000).toISOString(),
          data: {
            slug: 'home',
            title: 'Página fictícia F9',
            sections: [{ key: 'intro', body: content }],
          },
        });
        const pageBefore = await db.page.findUniqueOrThrow({ where: { slug: 'home' } });
        assert.equal(parseMigrationBatch(pageBatch).records.at(-1)?.kind, 'page');
        await rejectWithoutWrites(pageBatch, 'DESTINATION_CONFLICT');
        assert.deepEqual(
          await db.page.findUniqueOrThrow({ where: { id: pageBefore.id } }),
          pageBefore,
        );
        const settingsBefore = await db.siteSetting.findUniqueOrThrow({ where: { id: 'site' } });
        const settingsBatch = fixture();
        settingsBatch.records.push({
          kind: 'settings',
          id: 'site',
          data: { siteName: 'Portal fictício da carga F9', address: {}, socialLinks: [] },
        });
        await rejectWithoutWrites(settingsBatch, 'DESTINATION_CONFLICT');
        assert.deepEqual(
          await db.siteSetting.findUniqueOrThrow({ where: { id: 'site' } }),
          settingsBefore,
        );
      },
    );

    await t.test(
      'a failure in the final editorial payload leaves no earlier records or receipt',
      async () => {
        const input = fixture(true);
        // PostgreSQL rejects NUL text. If preflight accepts it, article insertion occurs after taxonomy/area/profile writes.
        record(input, 'article').data.excerpt = 'Resumo fictício com caractere inválido\u0000';
        const before = await counts();
        await assert.rejects(async () => {
          const batch = parseMigrationBatch(input);
          await migrateBatch(db, batch, options(batch));
        });
        assert.deepEqual(await counts(), before);
        assert.equal(await db.category.count({ where: { id: record(input, 'category').id } }), 0);
        assert.equal(
          await db.professional.count({ where: { id: record(input, 'professional').id } }),
          0,
        );
        assert.equal(
          await db.auditEvent.count({
            where: { action: 'migration.imported', resourceId: input.batchId },
          }),
          0,
        );
      },
    );

    await t.test(
      'operator, environment, digest and database confirmations reject unauthorized writes',
      async () => {
        const batch = parseMigrationBatch(fixture());
        const before = await counts();
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), actorId: author.id }),
          hasIssue('INVALID_IMPORT_ACTOR'),
        );
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), actorId: randomUUID() }),
          hasIssue('INVALID_IMPORT_ACTOR'),
        );
        const disabledId = randomUUID();
        userIds.add(disabledId);
        await db.user.create({
          data: {
            id: disabledId,
            email: `f9-disabled-${disabledId}@example.invalid`,
            name: 'Operador fictício desativado',
            role: 'ADMIN',
            isActive: false,
            passwordHash: admin.passwordHash,
            isMock: true,
          },
        });
        const withDisabled = await counts();
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), actorId: disabledId }),
          hasIssue('INVALID_IMPORT_ACTOR'),
        );
        for (const override of [
          { APP_ENV: 'staging' },
          { APP_ENV: 'production', NODE_ENV: 'production', MOCK_CONTENT: 'false' },
          { NODE_ENV: 'test' },
          { MOCK_CONTENT: 'false' },
        ])
          await assert.rejects(
            migrateBatch(db, batch, {
              ...options(batch),
              environment: { ...environment, ...override },
            }),
            hasIssue('FIXTURE_ENVIRONMENT_REQUIRED'),
          );
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), confirmSha256: '0'.repeat(64) }),
          hasIssue('DIGEST_CONFIRMATION_REQUIRED'),
        );
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), confirmDatabase: 'unconfirmed_database' }),
          hasIssue('DATABASE_CONFIRMATION_REQUIRED'),
        );
        await assert.rejects(
          migrateBatch(db, batch, { ...options(batch), confirmDatabase: undefined }),
          hasIssue('DATABASE_CONFIRMATION_REQUIRED'),
        );
        assert.deepEqual(await counts(), withDisabled);
        await db.user.delete({ where: { id: disabledId } });
        userIds.delete(disabledId);
        assert.deepEqual(await counts(), before);
      },
    );
  } finally {
    try {
      await db.auditEvent.deleteMany({
        where: {
          action: 'migration.imported',
          resource: 'migration-batch',
          resourceId: { in: [...batchIds] },
        },
      });
      await db.redirect.deleteMany({ where: { sourcePath: { in: [...redirectPaths] } } });
      await db.article.deleteMany({ where: { id: { in: [...ids] } } });
      await db.faq.deleteMany({ where: { id: { in: [...ids] } } });
      await db.page.deleteMany({ where: { id: { in: [...ids] } } });
      await db.professional.deleteMany({ where: { id: { in: [...ids] } } });
      await db.practiceArea.deleteMany({ where: { id: { in: [...ids] } } });
      await db.tag.deleteMany({ where: { id: { in: [...ids] } } });
      await db.category.deleteMany({ where: { id: { in: [...ids] } } });
      await db.media.deleteMany({ where: { id: { in: [...mediaIds] } } });
      await db.user.deleteMany({ where: { id: { in: [...userIds] } } });
    } finally {
      await db.$disconnect();
    }
  }
});
