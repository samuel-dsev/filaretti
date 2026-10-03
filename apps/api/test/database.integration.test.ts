import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { testEnvironment } from './helpers';

async function withDatabase(run: (client: PrismaService) => Promise<void>) {
  assert.ok(process.env.DATABASE_URL, 'A real isolated PostgreSQL database is required');
  const client = new PrismaService(
    testEnvironment({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_TIMEOUT_MS: 5000 }),
  );
  try {
    await run(client);
  } finally {
    await client.$disconnect();
  }
}

const document = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function prismaCode(code: string) {
  return (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

test('real seed graph has the planned fixture counts and complete relationships', async () => {
  await withDatabase(async (client) => {
    const users = await client.user.findMany({
      where: {
        email: { in: ['admin@filaretti.test', 'editor@filaretti.test', 'author@filaretti.test'] },
      },
    });
    assert.deepEqual(users.map((user) => user.role).sort(), ['ADMIN', 'AUTHOR', 'EDITOR']);
    assert.ok(users.every((user) => user.isMock && user.passwordHash.startsWith('$argon2id$')));
    const counts = await Promise.all([
      client.professional.count({ where: { slug: { startsWith: 'profissional-ficticio-' } } }),
      client.practiceArea.count({ where: { slug: { startsWith: 'area-ficticia-' } } }),
      client.article.count({ where: { slug: { startsWith: 'conteudo-ficticio-' } } }),
      client.category.count({ where: { slug: { startsWith: 'categoria-ficticia-' } } }),
      client.tag.count({ where: { slug: { startsWith: 'tag-ficticia-' } } }),
      client.faq.count({ where: { question: { startsWith: 'Pergunta Fictícia ' } } }),
      client.page.count({
        where: { slug: { in: ['home', 'o-escritorio', 'privacidade', 'cookies'] } },
      }),
      client.contact.count({
        where: {
          email: {
            in: [
              'contato-1@filaretti.test',
              'contato-2@filaretti.test',
              'contato-3@filaretti.test',
            ],
          },
        },
      }),
      client.newsletterSubscriber.count({
        where: {
          email: {
            in: [
              'assinante-1@filaretti.test',
              'assinante-2@filaretti.test',
              'assinante-3@filaretti.test',
            ],
          },
        },
      }),
    ]);
    assert.deepEqual(counts, [4, 5, 20, 6, 20, 6, 4, 3, 3]);
    const article = await client.article.findUniqueOrThrow({
      where: { slug: 'conteudo-ficticio-01' },
      include: {
        author: { include: { practiceAreas: true } },
        createdBy: true,
        categories: true,
        tags: true,
        practiceAreas: true,
      },
    });
    assert.equal(article.categories.length, 1);
    assert.equal(article.tags.length, 1);
    assert.equal(article.practiceAreas.length, 1);
    assert.equal(article.author.practiceAreas.length, 2);
    assert.ok(article.isMock && article.author.isMock && article.createdBy.isMock);
  });
});

test('Portuguese stemming searches published articles and migration has all three GIN indexes', async () => {
  await withDatabase(async (client) => {
    const rows = await client.$queryRaw<{ slug: string }[]>`
      SELECT slug FROM articles WHERE status = 'PUBLISHED' AND published_at <= now()
      AND search_vector @@ plainto_tsquery('portuguese', ${'direito'}) AND slug LIKE 'conteudo-ficticio-%'
    `;
    assert.equal(rows.length, 12, 'direito must match seeded direitos using Portuguese stemming');
    const hidden = await client.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM articles WHERE status <> 'PUBLISHED' AND search_vector IS NOT NULL
    `;
    assert.equal(hidden[0]!.count, 0n);
    const indexes = await client.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
      ('articles_public_search_gin', 'professionals_active_search_gin', 'areas_active_search_gin')
    `;
    assert.equal(indexes.length, 3);
  });
});

test('search vector follows editorial changes and clears when publication is withdrawn', async () => {
  await withDatabase(async (client) => {
    const author = await client.professional.findUniqueOrThrow({
      where: { slug: 'profissional-ficticio-1' },
    });
    const creator = await client.user.findUniqueOrThrow({
      where: { email: 'admin@filaretti.test' },
    });
    const article = await client.article.create({
      data: {
        slug: `db-search-${randomUUID()}`,
        title: 'Contratos demonstrativos',
        excerpt: 'Busca demonstrativa',
        content: document('Texto de teste.'),
        authorId: author.id,
        createdById: creator.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isMock: true,
      },
    });
    try {
      const before = await client.$queryRaw<
        { match: boolean }[]
      >`SELECT search_vector @@ plainto_tsquery('portuguese', ${'contrato'}) AS match FROM articles WHERE id = ${article.id}::uuid`;
      assert.equal(before[0]!.match, true);
      await client.article.update({
        where: { id: article.id },
        data: { title: 'Trabalhadores demonstrativos' },
      });
      const after = await client.$queryRaw<
        { match: boolean }[]
      >`SELECT search_vector @@ plainto_tsquery('portuguese', ${'trabalhador'}) AS match FROM articles WHERE id = ${article.id}::uuid`;
      assert.equal(after[0]!.match, true);
      await client.article.update({ where: { id: article.id }, data: { status: 'DRAFT' } });
      const withdrawn = await client.$queryRaw<
        { cleared: boolean }[]
      >`SELECT search_vector IS NULL AS cleared FROM articles WHERE id = ${article.id}::uuid`;
      assert.equal(withdrawn[0]!.cleared, true);
    } finally {
      await client.article.delete({ where: { id: article.id } });
    }
  });
});

test('real foreign keys restrict referenced authors, creators and taxonomies; email uniqueness is enforced', async () => {
  await withDatabase(async (client) => {
    const article = await client.article.findUniqueOrThrow({
      where: { slug: 'conteudo-ficticio-01' },
      include: { categories: true },
    });
    await assert.rejects(
      client.professional.delete({ where: { id: article.authorId } }),
      prismaCode('P2003'),
    );
    await assert.rejects(
      client.user.delete({ where: { id: article.createdById } }),
      prismaCode('P2003'),
    );
    await assert.rejects(
      client.category.delete({ where: { id: article.categories[0]!.categoryId } }),
      prismaCode('P2003'),
    );
    await assert.rejects(
      client.user.create({
        data: {
          email: 'admin@filaretti.test',
          name: 'Duplicate fixture',
          passwordHash: 'never-used',
          role: 'AUTHOR',
        },
      }),
      prismaCode('P2002'),
    );
    await assert.rejects(
      client.article.create({
        data: {
          slug: `db-invalid-${randomUUID()}`,
          title: 'Invalid relation',
          excerpt: 'Test',
          content: document('Test'),
          authorId: randomUUID(),
          createdById: article.createdById,
        },
      }),
      prismaCode('P2003'),
    );
  });
});

test('database protects referenced media and separates private attachments from public editorial assets', async () => {
  await withDatabase(async (client) => {
    const creator = await client.user.findUniqueOrThrow({
      where: { email: 'admin@filaretti.test' },
    });
    const author = await client.professional.findUniqueOrThrow({
      where: { slug: 'profissional-ficticio-1' },
    });
    const publicMedia = await client.media.create({
      data: {
        ownerId: creator.id,
        visibility: 'PUBLIC',
        storageKey: `test/${randomUUID()}`,
        publicUrl: 'https://example.invalid/test.png',
        mimeType: 'image/png',
        size: 10,
        isMock: true,
      },
    });
    const privateMedia = await client.media.create({
      data: {
        ownerId: creator.id,
        visibility: 'PRIVATE',
        storageKey: `test/${randomUUID()}`,
        mimeType: 'application/pdf',
        size: 10,
        isMock: true,
      },
    });
    let articleId: string | undefined;
    let contactId: string | undefined;
    try {
      const article = await client.article.create({
        data: {
          slug: `db-media-${randomUUID()}`,
          title: 'Media fixture',
          excerpt: 'Test',
          content: document('Test'),
          authorId: author.id,
          createdById: creator.id,
          coverMediaId: publicMedia.id,
        },
      });
      articleId = article.id;
      await assert.rejects(
        client.media.delete({ where: { id: publicMedia.id } }),
        prismaCode('P2003'),
      );
      await assert.rejects(
        client.article.update({
          where: { id: article.id },
          data: { coverMediaId: privateMedia.id },
        }),
      );
      await assert.rejects(
        client.media.update({
          where: { id: publicMedia.id },
          data: { visibility: 'PRIVATE', publicUrl: null },
        }),
      );
      const contact = await client.contact.create({
        data: {
          name: 'Attachment fixture',
          email: 'attachment@filaretti.test',
          subject: 'Test',
          message: 'Fictitious test',
          privacyVersion: 'test',
          consentedAt: new Date(),
          isMock: true,
        },
      });
      contactId = contact.id;
      await assert.rejects(
        client.contactAttachment.create({
          data: { contactId: contact.id, mediaId: publicMedia.id },
        }),
      );
      await client.contactAttachment.create({
        data: { contactId: contact.id, mediaId: privateMedia.id },
      });
      await assert.rejects(
        client.media.update({ where: { id: privateMedia.id }, data: { visibility: 'PUBLIC' } }),
      );
    } finally {
      if (articleId) await client.article.delete({ where: { id: articleId } });
      if (contactId) await client.contact.delete({ where: { id: contactId } });
      await client.media.deleteMany({ where: { id: { in: [publicMedia.id, privateMedia.id] } } });
    }
  });
});
