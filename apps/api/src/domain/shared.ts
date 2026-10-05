import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, MediaVisibility, type Media } from '@prisma/client';
import type { PaginatedResponse, PublicMedia, TaxonomySummary } from '@filaretti/types';
import type { PaginationDto } from './dto';
import { safeUrl } from './content';

export const DOMAIN_ENVIRONMENT = Symbol('DOMAIN_ENVIRONMENT');
export function paginated<T>(data: T[], total: number, query: PaginationDto): PaginatedResponse<T> {
  return {
    data,
    meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}
export function paging(query: PaginationDto) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
export function requireSort(query: PaginationDto, allowed: string[], fallback: string) {
  const sort = query.sort ?? fallback;
  if (!allowed.includes(sort)) throw new BadRequestException({ code: 'INVALID_SORT' });
  return sort;
}
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item: unknown): item is string => typeof item === 'string')
    : [];
}
export function taxonomy(value: { id: string; slug: string; name: string }): TaxonomySummary {
  return { id: value.id, slug: value.slug, name: value.name };
}
export const publicMediaInclude = {
  include: { _count: { select: { contactAttachments: true } } },
} satisfies Prisma.MediaDefaultArgs;
type EditorialMedia = Media & { _count: { contactAttachments: number } };
function publicMediaUrl(value: string, kind: 'image' | 'pdf'): boolean {
  if (!safeUrl(value)) return false;
  const extension = kind === 'pdf' ? /\.pdf$/iu : /\.(?:jpe?g|png|webp|avif)$/iu;
  if (value.startsWith('/')) {
    return (
      value.startsWith('/media/public/') &&
      !/[?#]/u.test(value) &&
      !value
        .slice(1)
        .split('/')
        .some((part) => part === '.' || part === '..' || part === '') &&
      extension.test(value)
    );
  }
  return value.startsWith('https://');
}
export function media(
  value: EditorialMedia | null,
  kind?: 'image' | 'pdf',
  excludeMocks = false,
): PublicMedia | null {
  if (
    !value ||
    (excludeMocks && value.isMock) ||
    value.visibility !== MediaVisibility.PUBLIC ||
    value._count.contactAttachments !== 0 ||
    !value.publicUrl ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0
  )
    return null;
  const mediaKind = value.mimeType === 'application/pdf' ? 'pdf' : 'image';
  const allowed =
    mediaKind === 'pdf'
      ? ['application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (
    (kind !== undefined && kind !== mediaKind) ||
    !allowed.includes(value.mimeType) ||
    !publicMediaUrl(value.publicUrl, mediaKind)
  )
    return null;
  return {
    id: value.id,
    alt: value.alt,
    mimeType: value.mimeType,
    size: value.size,
    url: value.publicUrl,
  };
}
export function exists<T>(value: T | null): T {
  if (value === null) throw new NotFoundException();
  return value;
}
export function versionUpdated(count: number) {
  if (count !== 1) throw new ConflictException({ code: 'VERSION_CONFLICT' });
}
export async function databaseWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException();
      if (error.code === 'P2003') throw new ConflictException({ code: 'RESOURCE_IN_USE' });
      if (error.code === 'P2025') throw new NotFoundException();
      if (error.code === 'P2034') throw new ConflictException({ code: 'VERSION_CONFLICT' });
    }
    throw error;
  }
}
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
) {
  await tx.auditEvent.create({ data: { actorId, action, resource, resourceId } });
}
export async function validateMedia(
  tx: Prisma.TransactionClient,
  id: string | null | undefined,
  kind: 'image' | 'pdf',
) {
  if (!id) return;
  const record = await tx.media.findUnique({ where: { id }, ...publicMediaInclude });
  const allowed =
    kind === 'pdf' ? ['application/pdf'] : ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!record || !media(record) || !allowed.includes(record.mimeType))
    throw new BadRequestException({ code: 'INVALID_RELATION' });
}
export async function validateRelations(
  tx: Prisma.TransactionClient,
  input: {
    authorId?: string;
    categoryIds?: string[];
    tagIds?: string[];
    practiceAreaIds?: string[];
  },
) {
  if (
    input.authorId &&
    !(await tx.professional.findFirst({ where: { id: input.authorId, isActive: true } }))
  )
    throw new BadRequestException({ code: 'INVALID_RELATION' });
  for (const [kind, ids] of [
    ['category', input.categoryIds],
    ['tag', input.tagIds],
    ['practiceArea', input.practiceAreaIds],
  ] as const) {
    if (ids) {
      const where = { id: { in: ids }, isActive: true };
      const count =
        kind === 'category'
          ? await tx.category.count({ where })
          : kind === 'tag'
            ? await tx.tag.count({ where })
            : await tx.practiceArea.count({ where });
      if (count !== ids.length) throw new BadRequestException({ code: 'INVALID_RELATION' });
    }
  }
}
