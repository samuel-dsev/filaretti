import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { queueRevalidation } from '../src/cms/outbox';
import { PracticeAreaDto } from '../src/domain/dto';
import { audit, json } from '../src/domain/shared';
import { practiceAreaContent } from './practice-area-content';
import { createSeedClient } from './seed-client';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APP_ENV !== 'development' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5434' ||
    url.pathname !== '/filaretti_dev'
  ) {
    throw new Error('LOCAL_PRACTICE_AREA_IMPORT_FORBIDDEN');
  }

  for (const { id, ...data } of practiceAreaContent) {
    const errors = validateSync(plainToInstance(PracticeAreaDto, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) throw new Error(`INVALID_PRACTICE_AREA_${id}`);
  }

  const client = createSeedClient();
  try {
    const result = await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
        take: 2,
      });
      const [admin] = admins;
      if (!admin || admins.length !== 1) throw new Error('LOCAL_PRACTICE_AREA_ADMIN_REQUIRED');

      const { _max } = await tx.practiceArea.aggregate({ _max: { sortOrder: true } });
      let sortOrder = _max.sortOrder ?? -1;
      const publishedPaths: string[] = [];
      for (const area of practiceAreaContent) {
        const existing = await tx.practiceArea.findUnique({
          where: { slug: area.slug },
          select: { id: true },
        });
        if (existing) {
          if (existing.id !== area.id) throw new Error('LOCAL_PRACTICE_AREA_SLUG_COLLISION');
          continue;
        }

        const path = `/areas-de-atuacao/${area.slug}`;
        if (await tx.redirect.findUnique({ where: { sourcePath: path } })) {
          throw new Error('LOCAL_PRACTICE_AREA_SLUG_RESERVED');
        }
        sortOrder += 1;
        if (sortOrder > 10000) throw new Error('LOCAL_PRACTICE_AREA_ORDER_EXHAUSTED');
        await tx.practiceArea.create({
          data: {
            ...area,
            description: json(area.description),
            services: json(area.services),
            sortOrder,
            isActive: true,
            isMock: true,
          },
        });
        await audit(tx, admin.id, 'practiceArea.created', 'practiceArea', area.id);
        publishedPaths.push(path);
      }
      if (publishedPaths.length) await queueRevalidation(tx, publishedPaths);
      return {
        published: publishedPaths.length,
        existing: practiceAreaContent.length - publishedPaths.length,
      };
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.$disconnect();
  }
}

void main().catch(() => {
  console.error('Não foi possível publicar as áreas de atuação no banco local.');
  process.exitCode = 1;
});
