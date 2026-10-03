import { ArticleType, PublicationStatus, UserRole, type PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { createSeedClient, reportSeedFailure } from './seed-client';

// Deliberately public test fixtures. These accounts must never reach production.
export const DEVELOPMENT_PASSWORD = 'Local-F2-Ficticio!2026';
export const DEVELOPMENT_USERS = [
  {
    id: fixtureId(1, 1),
    email: 'admin@filaretti.test',
    name: 'Admin Fictício',
    role: UserRole.ADMIN,
  },
  {
    id: fixtureId(1, 2),
    email: 'editor@filaretti.test',
    name: 'Editor Fictício',
    role: UserRole.EDITOR,
  },
  {
    id: fixtureId(1, 3),
    email: 'author@filaretti.test',
    name: 'Autor Fictício',
    role: UserRole.AUTHOR,
  },
] as const;

function fixtureId(group: number, number: number): string {
  return `${group.toString(16)}0000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
}

function document(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

export function assertDevelopmentSeedEnvironment(): void {
  if (
    process.env.APP_ENV !== 'development' ||
    process.env.NODE_ENV !== 'development' ||
    process.env.MOCK_CONTENT !== 'true'
  ) {
    throw new Error('DEVELOPMENT_SEED_FORBIDDEN');
  }
}

export async function seedDevelopment(client: PrismaClient): Promise<void> {
  assertDevelopmentSeedEnvironment();
  const passwordHash = await hashPassword(DEVELOPMENT_PASSWORD);
  // A single transaction avoids partially seeded graphs. Existing rows are preserved.
  await client.$transaction(
    async (tx) => {
      const users = [];
      for (const user of DEVELOPMENT_USERS) {
        const existing = await tx.user.findUnique({ where: { email: user.email } });
        if (existing && !existing.isMock) throw new Error('SEED_IDENTITY_COLLISION');
        users.push(
          await tx.user.upsert({
            where: { email: user.email },
            update: {},
            create: { ...user, passwordHash, isMock: true },
          }),
        );
      }
      const professionals = [];
      for (let i = 1; i <= 4; i++) {
        professionals.push(
          await tx.professional.upsert({
            where: { slug: `profissional-ficticio-${i}` },
            update: {},
            create: {
              id: fixtureId(2, i),
              slug: `profissional-ficticio-${i}`,
              name: `Profissional Fictício ${i}`,
              title: 'Perfil demonstrativo — sem credencial profissional real',
              bio: document('Biografia fictícia destinada exclusivamente ao desenvolvimento.'),
              education: ['Formação fictícia para demonstração'],
              experience: ['Experiência fictícia para demonstração'],
              sortOrder: i,
              isMock: true,
            },
          }),
        );
      }
      const areas = [];
      for (let i = 1; i <= 5; i++) {
        areas.push(
          await tx.practiceArea.upsert({
            where: { slug: `area-ficticia-${i}` },
            update: {},
            create: {
              id: fixtureId(3, i),
              slug: `area-ficticia-${i}`,
              name: `Área Fictícia ${i}`,
              summary: 'Área demonstrativa, sem oferta real de serviços.',
              description: document('Descrição fictícia sobre direitos e responsabilidades.'),
              services: ['Serviço fictício demonstrativo'],
              sortOrder: i,
              isMock: true,
            },
          }),
        );
      }
      for (let i = 0; i < professionals.length; i++) {
        const professional = professionals[i]!;
        for (const offset of [0, 1]) {
          const area = areas[(i + offset) % areas.length]!;
          await tx.professionalPracticeArea.upsert({
            where: {
              professionalId_practiceAreaId: {
                professionalId: professional.id,
                practiceAreaId: area.id,
              },
            },
            update: {},
            create: { professionalId: professional.id, practiceAreaId: area.id },
          });
        }
      }
      const categories = [];
      for (let i = 1; i <= 6; i++) {
        categories.push(
          await tx.category.upsert({
            where: { slug: `categoria-ficticia-${i}` },
            update: {},
            create: {
              id: fixtureId(5, i),
              slug: `categoria-ficticia-${i}`,
              name: `Categoria Fictícia ${i}`,
              isMock: true,
            },
          }),
        );
      }
      const tags = [];
      for (let i = 1; i <= 20; i++) {
        tags.push(
          await tx.tag.upsert({
            where: { slug: `tag-ficticia-${i}` },
            update: {},
            create: {
              id: fixtureId(6, i),
              slug: `tag-ficticia-${i}`,
              name: `Tag Fictícia ${i}`,
              isMock: true,
            },
          }),
        );
      }
      const articleTypes = [ArticleType.ARTICLE, ArticleType.UPDATE, ArticleType.GUIDE] as const;
      const baseDate = new Date('2026-09-01T12:00:00.000Z');
      for (let i = 1; i <= 20; i++) {
        const status =
          i <= 12
            ? PublicationStatus.PUBLISHED
            : i <= 16
              ? PublicationStatus.DRAFT
              : i <= 18
                ? PublicationStatus.SCHEDULED
                : PublicationStatus.ARCHIVED;
        const article = await tx.article.upsert({
          where: { slug: `conteudo-ficticio-${i.toString().padStart(2, '0')}` },
          update: {},
          create: {
            id: fixtureId(4, i),
            slug: `conteudo-ficticio-${i.toString().padStart(2, '0')}`,
            title: `Conteúdo Fictício ${i} — direitos e responsabilidades`,
            excerpt:
              'Conteúdo demonstrativo. Não constitui orientação jurídica ou material aprovado.',
            content: document(
              `Texto fictício ${i} sobre direitos, responsabilidades e informação jurídica. Somente para desenvolvimento.`,
            ),
            type: articleTypes[(i - 1) % articleTypes.length]!,
            status,
            authorId: professionals[(i - 1) % professionals.length]!.id,
            createdById: users[(i - 1) % users.length]!.id,
            featured: i <= 3,
            readingTimeMinutes: 2,
            publishedAt:
              status === PublicationStatus.PUBLISHED
                ? new Date(baseDate.getTime() + i * 86400000)
                : null,
            scheduledAt:
              status === PublicationStatus.SCHEDULED ? new Date('2099-01-01T12:00:00.000Z') : null,
            isMock: true,
          },
        });
        const categoryId = categories[(i - 1) % categories.length]!.id;
        const tagId = tags[i - 1]!.id;
        const practiceAreaId = areas[(i - 1) % areas.length]!.id;
        await tx.articleCategory.upsert({
          where: { articleId_categoryId: { articleId: article.id, categoryId } },
          update: {},
          create: { articleId: article.id, categoryId },
        });
        await tx.articleTag.upsert({
          where: { articleId_tagId: { articleId: article.id, tagId } },
          update: {},
          create: { articleId: article.id, tagId },
        });
        await tx.articlePracticeArea.upsert({
          where: { articleId_practiceAreaId: { articleId: article.id, practiceAreaId } },
          update: {},
          create: { articleId: article.id, practiceAreaId },
        });
      }
      for (let i = 1; i <= 6; i++) {
        await tx.faq.upsert({
          where: { id: fixtureId(7, i) },
          update: {},
          create: {
            id: fixtureId(7, i),
            question: `Pergunta Fictícia ${i}?`,
            answer: document('Resposta fictícia destinada exclusivamente à demonstração.'),
            practiceAreaId: i === 1 ? null : areas[(i - 2) % areas.length]!.id,
            sortOrder: i,
            isMock: true,
          },
        });
      }
      for (const [index, slug] of ['home', 'o-escritorio', 'privacidade', 'cookies'].entries()) {
        await tx.page.upsert({
          where: { slug },
          update: {},
          create: {
            id: fixtureId(8, index + 1),
            slug,
            title: `Página Fictícia — ${slug}`,
            sections: [
              {
                key: 'intro',
                heading: 'Conteúdo fictício',
                body: document('Texto fictício. A versão definitiva depende de material aprovado.'),
              },
            ],
            status: PublicationStatus.PUBLISHED,
            publishedAt: baseDate,
            isMock: true,
          },
        });
      }
      for (let i = 1; i <= 3; i++) {
        await tx.contact.upsert({
          where: { id: fixtureId(9, i) },
          update: {},
          create: {
            id: fixtureId(9, i),
            name: `Contato Fictício ${i}`,
            email: `contato-${i}@filaretti.test`,
            subject: 'Solicitação fictícia',
            message: 'Mensagem demonstrativa sem dados de cliente real.',
            privacyVersion: 'mock-development-v1',
            consentedAt: baseDate,
            isMock: true,
          },
        });
        await tx.newsletterSubscriber.upsert({
          where: { email: `assinante-${i}@filaretti.test` },
          update: {},
          create: {
            id: fixtureId(10, i),
            email: `assinante-${i}@filaretti.test`,
            name: `Assinante Fictício ${i}`,
            status: i === 1 ? 'ACTIVE' : i === 2 ? 'PENDING' : 'UNSUBSCRIBED',
            consentVersion: 'mock-development-v1',
            consentedAt: baseDate,
            confirmedAt: i !== 2 ? baseDate : null,
            unsubscribedAt: i === 3 ? baseDate : null,
            isMock: true,
          },
        });
      }
      await tx.siteSetting.upsert({
        where: { id: 'site' },
        update: {},
        create: {
          id: 'site',
          siteName: 'Filaretti — demonstração fictícia',
          publicEmail: 'escritorio@filaretti.test',
          address: {},
          socialLinks: [],
          isMock: true,
        },
      });
    },
    { timeout: 30000 },
  );
}

if (require.main === module) {
  let client: PrismaClient | undefined;
  Promise.resolve()
    .then(async () => {
      assertDevelopmentSeedEnvironment();
      client = createSeedClient();
      await seedDevelopment(client);
      process.stdout.write('Development seed completed (fictitious data only).\n');
    })
    .catch((error: unknown) => reportSeedFailure('DEVELOPMENT_SEED_FAILED', error))
    .finally(async () => client?.$disconnect());
}
