import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  DEVELOPMENT_ARTICLES,
  DEVELOPMENT_CATEGORIES,
  DEVELOPMENT_FAQS,
  DEVELOPMENT_PAGES,
  DEVELOPMENT_PRACTICE_AREAS,
  DEVELOPMENT_PROFESSIONALS,
  DEVELOPMENT_SITE_NAME,
  DEVELOPMENT_TAGS,
} from './development-content';
import {
  assertDevelopmentSeedEnvironment,
  DEVELOPMENT_USERS,
  developmentArticleContent,
  developmentPageSections,
  document,
  fixtureId,
} from './seed-development';
import { createSeedClient } from './seed-client';

const ids = (group: number, count: number) =>
  Array.from({ length: count }, (_, index) => fixtureId(group, index + 1));

async function snapshot(tx: Prisma.TransactionClient) {
  return {
    professionals: await tx.professional.findMany({
      where: { id: { in: ids(2, 4) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    areas: await tx.practiceArea.findMany({
      where: { id: { in: ids(3, 5) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    articles: await tx.article.findMany({
      where: { id: { in: ids(4, 20) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    categories: await tx.category.findMany({
      where: { id: { in: ids(5, 6) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    tags: await tx.tag.findMany({
      where: { id: { in: ids(6, 20) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    faqs: await tx.faq.findMany({
      where: { id: { in: ids(7, 6) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    pages: await tx.page.findMany({
      where: { id: { in: ids(8, 4) }, isMock: true },
      orderBy: { id: 'asc' },
    }),
    users: await tx.user.findMany({
      where: { id: { in: ids(1, 3) }, isMock: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, isMock: true },
      orderBy: { id: 'asc' },
    }),
    contacts: await tx.contact.findMany({
      where: { id: { in: ids(9, 3) }, isMock: true },
      select: {
        id: true,
        name: true,
        subject: true,
        message: true,
        email: true,
        status: true,
        isMock: true,
      },
      orderBy: { id: 'asc' },
    }),
    subscribers: await tx.newsletterSubscriber.findMany({
      where: { id: { in: ids(10, 3) }, isMock: true },
      select: { id: true, name: true, email: true, status: true, isMock: true },
      orderBy: { id: 'asc' },
    }),
    settings: await tx.siteSetting.findMany({ where: { id: 'site', isMock: true } }),
  };
}

// Everything outside these written fields must remain identical, including all media references.
const writtenFields: Record<string, readonly string[]> = {
  professionals: ['name', 'title', 'bio', 'education', 'experience'],
  areas: ['name', 'summary', 'description', 'services'],
  articles: ['title', 'excerpt', 'content', 'seoTitle', 'seoDescription'],
  categories: ['name'],
  tags: ['name'],
  faqs: ['question', 'answer'],
  pages: ['title', 'seoTitle', 'seoDescription', 'sections'],
  users: ['name'],
  contacts: ['name', 'subject', 'message'],
  subscribers: ['name'],
  settings: ['siteName'],
};

function unchangedFields(data: Awaited<ReturnType<typeof snapshot>>) {
  return Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [
      table,
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key]) => !['updatedAt', 'version', ...writtenFields[table]!].includes(key),
          ),
        ),
      ),
    ]),
  );
}

export async function refreshDevelopmentContent(client: PrismaClient): Promise<void> {
  assertDevelopmentSeedEnvironment();
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) {
    throw new Error('LOCAL_DATABASE_REQUIRED');
  }
  const backupDirectory = resolve(__dirname, '../../../.local');
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = resolve(backupDirectory, `content-before-${Date.now()}.json`);
  const expectedCounts = {
    professionals: 4,
    areas: 5,
    articles: 20,
    categories: 6,
    tags: 20,
    faqs: 6,
    pages: 4,
    users: 3,
    contacts: 3,
    subscribers: 3,
    settings: 1,
  };
  await client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
      const before = await snapshot(tx);
      for (const [table, count] of Object.entries(expectedCounts)) {
        if (before[table as keyof typeof before].length !== count) {
          throw new Error('DEVELOPMENT_FIXTURE_SET_CHANGED');
        }
      }
      // This ignored local snapshot contains copy only from the known mock fixtures, no passwords/tokens.
      await writeFile(backupPath, JSON.stringify(before, null, 2), { flag: 'wx' });
      const mediaBefore = JSON.stringify(await tx.media.findMany({ orderBy: { id: 'asc' } }));
      for (const [index, copy] of DEVELOPMENT_PROFESSIONALS.entries()) {
        await tx.professional.update({
          where: { id: fixtureId(2, index + 1), isMock: true },
          data: {
            name: copy.name,
            title: copy.title,
            bio: document(copy.bio),
            education: [...copy.education],
            experience: [...copy.experience],
            version: { increment: 1 },
          },
        });
      }
      for (const [index, copy] of DEVELOPMENT_PRACTICE_AREAS.entries()) {
        await tx.practiceArea.update({
          where: { id: fixtureId(3, index + 1), isMock: true },
          data: {
            name: copy.name,
            summary: copy.summary,
            description: document(copy.description),
            services: [...copy.services],
            version: { increment: 1 },
          },
        });
      }
      for (const [index, copy] of DEVELOPMENT_ARTICLES.entries()) {
        await tx.article.update({
          where: { id: fixtureId(4, index + 1), isMock: true },
          data: {
            title: copy.title,
            excerpt: copy.excerpt,
            content: developmentArticleContent(index),
            seoTitle: copy.title,
            seoDescription: copy.excerpt,
            version: { increment: 1 },
          },
        });
      }
      for (const [index, name] of DEVELOPMENT_CATEGORIES.entries()) {
        await tx.category.update({
          where: { id: fixtureId(5, index + 1), isMock: true },
          data: { name },
        });
      }
      for (const [index, name] of DEVELOPMENT_TAGS.entries()) {
        await tx.tag.update({
          where: { id: fixtureId(6, index + 1), isMock: true },
          data: { name },
        });
      }
      for (const [index, copy] of DEVELOPMENT_FAQS.entries()) {
        await tx.faq.update({
          where: { id: fixtureId(7, index + 1), isMock: true },
          data: {
            question: copy.question,
            answer: document(copy.answer),
            version: { increment: 1 },
          },
        });
      }
      for (const [index, slug] of (
        ['home', 'o-escritorio', 'privacidade', 'cookies'] as const
      ).entries()) {
        const copy = DEVELOPMENT_PAGES[slug];
        await tx.page.update({
          where: { id: fixtureId(8, index + 1), slug, isMock: true },
          data: {
            title: copy.title,
            seoTitle: copy.seoTitle,
            seoDescription: copy.seoDescription,
            sections: developmentPageSections(slug),
            version: { increment: 1 },
          },
        });
      }
      for (const user of DEVELOPMENT_USERS) {
        await tx.user.update({
          where: { id: user.id, email: user.email, isMock: true },
          data: { name: user.name },
        });
      }
      for (const [index, name] of [
        'Camila Sampaio',
        'André Lacerda',
        'Beatriz Monteiro',
      ].entries()) {
        await tx.contact.update({
          where: { id: fixtureId(9, index + 1), isMock: true },
          data: {
            name,
            subject: [
              'Revisão de contrato comercial',
              'Planejamento societário',
              'Consulta inicial',
            ][index]!,
            message:
              'Gostaria de agendar uma conversa para apresentar minha necessidade e conhecer as possibilidades de atendimento.',
            version: { increment: 1 },
          },
        });
      }
      for (const [index, name] of [
        'Luiza Carvalho',
        'Pedro Vasconcelos',
        'Isabela Moura',
      ].entries()) {
        await tx.newsletterSubscriber.update({
          where: { id: fixtureId(10, index + 1), isMock: true },
          data: { name, version: { increment: 1 } },
        });
      }
      await tx.siteSetting.update({
        where: { id: 'site', isMock: true },
        data: { siteName: DEVELOPMENT_SITE_NAME, version: { increment: 1 } },
      });
      const after = await snapshot(tx);
      if (
        JSON.stringify(unchangedFields(before)) !== JSON.stringify(unchangedFields(after)) ||
        mediaBefore !== JSON.stringify(await tx.media.findMany({ orderBy: { id: 'asc' } }))
      ) {
        throw new Error('NON_TEXT_FIELD_CHANGED');
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
  process.stdout.write(
    `${JSON.stringify({ updated: expectedCounts, nonTextFieldsPreserved: true, mediaPreserved: true })}\n`,
  );
}

if (require.main === module) {
  let client: PrismaClient | undefined;
  Promise.resolve()
    .then(async () => {
      assertDevelopmentSeedEnvironment();
      client = createSeedClient();
      await refreshDevelopmentContent(client);
    })
    .catch(() => {
      process.stderr.write('DEVELOPMENT_COPY_REFRESH_FAILED\n');
      process.exitCode = 1;
    })
    .finally(async () => client?.$disconnect());
}
