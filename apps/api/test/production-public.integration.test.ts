import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { ArticlesService } from '../src/domain/articles.service';
import { InstitutionService } from '../src/domain/institution.service';
import { MediaService } from '../src/cms/media.service';
import { StorageService } from '../src/cms/storage.service';
import { testEnvironment } from './helpers';

test('production public reads exclude residual mocks and nested mock relations in PostgreSQL', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'Use the isolated integration database runner.');
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
  });
  const app = await createApplication(environment, new SanitizedLogger(() => undefined));
  await app.init();
  const db = app.get(PrismaService);
  // Exercise production policy against a disposable database without bootstrapping production.
  const production = { ...environment, APP_ENV: 'production' as const };
  const articles = new ArticlesService(db, production);
  const institutions = new InstitutionService(db, production);
  const localInstitutions = new InstitutionService(db, environment);
  const storage = app.get(StorageService);
  const media = new MediaService(db, storage, production);
  const prefix = `public-mock-${randomUUID()}`;
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fixture fictícia' }] }],
  };
  const query = { page: 1, limit: 50 };
  const actor = await db.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      name: 'Fixture fictícia',
      passwordHash: 'unusable-fixture',
      role: 'ADMIN',
      isMock: true,
    },
  });
  const settings = await db.siteSetting.findUniqueOrThrow({ where: { id: 'site' } });
  try {
    const photoKey = `${randomUUID()}.png`;
    const pdfKey = `${randomUUID()}.pdf`;
    const photo = await db.media.create({
      data: {
        ownerId: actor.id,
        visibility: 'PUBLIC',
        storageKey: photoKey,
        publicUrl: `/media/public/${photoKey}`,
        mimeType: 'image/png',
        size: 20,
        isMock: true,
      },
    });
    const pdf = await db.media.create({
      data: {
        ownerId: actor.id,
        visibility: 'PUBLIC',
        storageKey: pdfKey,
        publicUrl: `/media/public/${pdfKey}`,
        mimeType: 'application/pdf',
        size: 20,
        isMock: true,
      },
    });
    const person = await db.professional.create({
      data: {
        slug: `${prefix}-person`,
        name: 'Profissional fictício',
        title: 'Fixture',
        bio: doc,
        education: [],
        experience: [],
        photoMediaId: photo.id,
        isMock: false,
      },
    });
    const mockPerson = await db.professional.create({
      data: {
        slug: `${prefix}-mock-person`,
        name: 'Profissional fictício mock',
        title: 'Fixture',
        bio: doc,
        education: [],
        experience: [],
        isMock: true,
      },
    });
    const area = await db.practiceArea.create({
      data: {
        slug: `${prefix}-area`,
        name: 'Área fictícia',
        summary: 'Fixture',
        description: doc,
        services: [],
        isMock: false,
        professionals: {
          create: [{ professionalId: person.id }, { professionalId: mockPerson.id }],
        },
      },
    });
    const mockArea = await db.practiceArea.create({
      data: {
        slug: `${prefix}-mock-area`,
        name: 'Área fictícia mock',
        summary: 'Fixture',
        description: doc,
        services: [],
        isMock: true,
        professionals: { create: { professionalId: person.id } },
      },
    });
    const category = await db.category.create({
      data: { slug: `${prefix}-category`, name: 'Categoria fictícia', isMock: true },
    });
    const tag = await db.tag.create({
      data: { slug: `${prefix}-tag`, name: 'Tag fictícia', isMock: true },
    });
    const articleInput = {
      title: 'Artigo fictício',
      excerpt: 'Fixture',
      content: doc,
      createdById: actor.id,
      authorId: person.id,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(Date.now() - 10000),
    };
    const article = await db.article.create({
      data: {
        ...articleInput,
        slug: `${prefix}-article`,
        type: 'GUIDE',
        coverMediaId: photo.id,
        pdfMediaId: pdf.id,
        isMock: false,
        categories: { create: { categoryId: category.id } },
        tags: { create: { tagId: tag.id } },
        practiceAreas: { create: [{ practiceAreaId: area.id }, { practiceAreaId: mockArea.id }] },
      },
    });
    const mockArticle = await db.article.create({
      data: { ...articleInput, slug: `${prefix}-mock-article`, isMock: true },
    });
    const mockAuthorArticle = await db.article.create({
      data: {
        ...articleInput,
        authorId: mockPerson.id,
        slug: `${prefix}-mock-author`,
        isMock: false,
      },
    });
    const page = await db.page.create({
      data: {
        slug: `${prefix}-page`,
        title: 'Página fictícia',
        sections: [],
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isMock: true,
      },
    });
    const mockFaq = await db.faq.create({
      data: { question: `${prefix} Pergunta fictícia mock`, answer: doc, isMock: true },
    });
    const relationFaq = await db.faq.create({
      data: {
        question: `${prefix} Pergunta fictícia relacionada`,
        answer: doc,
        practiceAreaId: mockArea.id,
        isMock: false,
      },
    });

    await t.test(
      'mock roots and articles with mock authors cannot be opened directly',
      async () => {
        for (const task of [
          () => articles.publicDetail(mockArticle.slug),
          () => articles.publicDetail(mockAuthorArticle.slug),
          () => institutions.professionalDetail(mockPerson.slug),
          () => institutions.areaDetail(mockArea.slug),
          () => institutions.taxonomyDetail('category', category.slug),
          () => institutions.taxonomyDetail('tag', tag.slug),
          () => institutions.pageDetail(page.slug),
          () => institutions.faqDetail(mockFaq.id),
          () => institutions.faqDetail(relationFaq.id),
          () => media.publicAsset(photoKey),
        ]) {
          await assert.rejects(task, NotFoundException);
        }
        const result = await articles.publicList({ ...query, author: person.slug });
        assert.deepEqual(
          result.data.map((row) => row.id),
          [article.id],
        );
        assert.equal(result.meta.total, 1);
        assert.equal(
          (await institutions.pages(query)).data.some((row) => row.id === page.id),
          false,
        );
        assert.equal(
          (await institutions.listTaxonomies('category', query)).data.some(
            (row) => row.id === category.id,
          ),
          false,
        );
        assert.equal(
          (await institutions.faqs(query)).data.some(
            (row) => row.id === mockFaq.id || row.id === relationFaq.id,
          ),
          false,
        );
      },
    );

    await t.test('real content omits mock media and linked taxonomy/professionals', async () => {
      const result = await articles.publicDetail(article.slug);
      assert.equal(result.cover, null);
      assert.equal(result.pdf, null);
      assert.equal(result.author?.photo, null);
      assert.deepEqual(result.categories, []);
      assert.deepEqual(result.tags, []);
      assert.deepEqual(
        result.practiceAreas.map((row) => row.id),
        [area.id],
      );
      assert.deepEqual(
        (await institutions.areaDetail(area.slug)).professionals.map((row) => row.id),
        [person.id],
      );
      const profile = await institutions.professionalDetail(person.slug);
      assert.equal(profile.photo, null);
      assert.equal(
        profile.practiceAreas.some((row) => row.id === mockArea.id),
        false,
      );
      const facets = await articles.publicFilters();
      assert.equal(
        facets.categories.some((row) => row.id === category.id),
        false,
      );
      assert.equal(
        facets.tags.some((row) => row.id === tag.id),
        false,
      );
      assert.equal(
        facets.areas.some((row) => row.id === mockArea.id),
        false,
      );
      assert.equal(
        facets.authors.some((row) => row.id === mockPerson.id),
        false,
      );
    });

    await t.test(
      'settings fail closed in production while admin/local fixtures remain reviewable',
      async () => {
        await db.siteSetting.update({ where: { id: 'site' }, data: { isMock: true } });
        await assert.rejects(institutions.settings(), NotFoundException);
        assert.equal('isMock' in (await institutions.settings(true)), true);
        assert.equal(
          (await localInstitutions.professionalDetail(mockPerson.slug)).id,
          mockPerson.id,
        );
        assert.equal(
          (await institutions.professionalDetail(mockPerson.id, true)).id,
          mockPerson.id,
        );
      },
    );
  } finally {
    await db.siteSetting.update({ where: { id: 'site' }, data: { isMock: settings.isMock } });
    await db.article.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.faq.deleteMany({ where: { question: { startsWith: prefix } } });
    await db.page.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.professionalPracticeArea.deleteMany({
      where: { professional: { slug: { startsWith: prefix } } },
    });
    await db.professional.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.practiceArea.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.category.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.tag.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.media.deleteMany({ where: { ownerId: actor.id } });
    await db.user.delete({ where: { id: actor.id } });
    await app.close();
  }
});
