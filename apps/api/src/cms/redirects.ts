import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { safeUrl } from '../domain/content';

export function redirectPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    safeUrl(path, true) &&
    path.length <= 500 &&
    /^\/[A-Za-z0-9_./-]*$/u.test(path) &&
    !/\/{2}|[?#]/u.test(path) &&
    !(path.length > 1 && path.endsWith('/')) &&
    !path.split('/').some((part) => part === '.' || part === '..') &&
    !/^\/(?:api|admin|preview|_next|media)(?:\/|$)/iu.test(path)
  );
}
export async function validateRedirectGraph(
  tx: Prisma.TransactionClient,
  value: { sourcePath: string; targetPath: string; isActive?: boolean },
  id?: string,
) {
  if (!redirectPath(value.sourcePath) || !redirectPath(value.targetPath))
    throw new BadRequestException();
  if (value.sourcePath === value.targetPath)
    throw new BadRequestException({ code: 'REDIRECT_LOOP' });
  if (value.isActive === false) return;
  const rows = await tx.redirect.findMany({
    where: { isActive: true, ...(id ? { id: { not: id } } : {}) },
    select: { sourcePath: true, targetPath: true },
  });
  const graph = new Map(rows.map((row) => [row.sourcePath, row.targetPath]));
  graph.set(value.sourcePath, value.targetPath);
  let path: string | undefined = value.sourcePath;
  const seen = new Set<string>();
  while (path !== undefined) {
    if (seen.has(path)) throw new BadRequestException({ code: 'REDIRECT_LOOP' });
    seen.add(path);
    path = graph.get(path);
  }
}
export async function preserveSlug(
  tx: Prisma.TransactionClient,
  sourcePath: string,
  targetPath: string,
  publiclyVisible = true,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
  if (await tx.redirect.findUnique({ where: { sourcePath: targetPath } }))
    throw new BadRequestException({ code: 'SLUG_RESERVED' });
  // Private edits still respect reserved URLs but never disclose unpublished slugs.
  if (!publiclyVisible) return;
  const existing = await tx.redirect.findUnique({ where: { sourcePath } });
  await validateRedirectGraph(tx, { sourcePath, targetPath }, existing?.id);
  if (existing)
    await tx.redirect.update({
      where: { id: existing.id },
      data: { targetPath, statusCode: 301, isActive: true, version: { increment: 1 } },
    });
  else await tx.redirect.create({ data: { sourcePath, targetPath, statusCode: 301 } });
}
