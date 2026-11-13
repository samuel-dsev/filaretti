import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { isTipTapDocument, plainText } from '../src/domain/content';
import { audit, json } from '../src/domain/shared';
import { queueRevalidation } from '../src/cms/outbox';
import { realEstateArticles } from './real-estate-articles';
import { createSeedClient } from './seed-client';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APP_ENV !== 'development' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5434' ||
    url.pathname !== '/filaretti_dev' ||
    !realEstateArticles.every(({ content }) => isTipTapDocument(content))
  ) {
    throw new Error('LOCAL_EDITORIAL_IMPORT_FORBIDDEN');
  }

  const client = createSeedClient();
  try {
    const result = await client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        const actors = await tx.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
          take: 2,
        });
        const [actor] = actors;
        if (!actor || actors.length !== 1) throw new Error('LOCAL_EDITORIAL_ADMIN_REQUIRED');

        const category = await tx.category.upsert({
          where: { slug: 'direito-imobiliario' },
          create: { slug: 'direito-imobiliario', name: 'Direito imobiliário', isMock: true },
          update: {},
        });
        if (!category.isActive) throw new Error('LOCAL_EDITORIAL_CATEGORY_INACTIVE');

        const publishedAt = Date.now();
        const publishedPaths: string[] = [];
        for (const [index, article] of realEstateArticles.entries()) {
          const existing = await tx.article.findUnique({ where: { slug: article.slug } });
          if (existing) {
            if (existing.id !== article.id) throw new Error('LOCAL_EDITORIAL_SLUG_COLLISION');
            continue;
          }
          const path = `/conteudos/${article.slug}`;
          if (await tx.redirect.findUnique({ where: { sourcePath: path } })) {
            throw new Error('LOCAL_EDITORIAL_SLUG_RESERVED');
          }
          const date = new Date(publishedAt - index);
          await tx.article.create({
            data: {
              ...article,
              content: json(article.content),
              authorId: null,
              createdById: actor.id,
              updatedById: actor.id,
              type: 'ARTICLE',
              status: 'PUBLISHED',
              publishedAt: date,
              updatedAt: date,
              readingTimeMinutes: Math.ceil(plainText(article.content).split(/\s+/u).length / 200),
              seoDescription: article.excerpt,
              categories: { create: { categoryId: category.id } },
              isMock: true,
            },
          });
          await audit(tx, actor.id, 'article.created', 'article', article.id);
          await audit(tx, actor.id, 'article.published', 'article', article.id);
          publishedPaths.push(path);
        }
        if (publishedPaths.length) await queueRevalidation(tx, publishedPaths);
        return {
          published: publishedPaths.length,
          existing: realEstateArticles.length - publishedPaths.length,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    console.log(JSON.stringify(result));
  } finally {
    await client.$disconnect();
  }
}

void main().catch(() => {
  console.error('Não foi possível publicar o lote editorial no banco local.');
  process.exitCode = 1;
});
