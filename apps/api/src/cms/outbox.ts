import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export async function queueRevalidation(tx: Prisma.TransactionClient, paths: string[] = ['/']) {
  return tx.outboxTask.create({
    data: {
      topic: 'cache.revalidate',
      idempotencyKey: `revalidate:${randomUUID()}`,
      payload: {
        paths: [...new Set(['/', '/conteudos', '/areas-de-atuacao', '/profissionais', ...paths])],
      },
    },
  });
}
