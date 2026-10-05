import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { Prisma, PublicationStatus, UserRole } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import type {
  PublicArticle,
  PublicArticleSummary,
  PublicEditorialFilters,
  ProfessionalSummary,
} from '@filaretti/types';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../auth/types';
import type {
  AdminArticleQueryDto,
  ArticleDto,
  ArticlePatchDto,
  ArticleQueryDto,
  PublicationDto,
} from './dto';
import { plainText, publicContent } from './content';
import { queueRevalidation } from '../cms/outbox';
import { preserveSlug } from '../cms/redirects';
import {
  audit,
  databaseWrite,
  DOMAIN_ENVIRONMENT,
  exists,
  json,
  media,
  publicMediaInclude,
  paginated,
  paging,
  requireSort,
  taxonomy,
  validateMedia,
  validateRelations,
  versionUpdated,
} from './shared';

const include = {
  author: { include: { photoMedia: publicMediaInclude } },
  coverMedia: publicMediaInclude,
  pdfMedia: publicMediaInclude,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  practiceAreas: { include: { practiceArea: true } },
} satisfies Prisma.ArticleInclude;
type ArticleRecord = Prisma.ArticleGetPayload<{ include: typeof include }>;
type Actor = AuthenticatedRequest['user'];
export function professionalSummary(
  record: Prisma.ProfessionalGetPayload<{ include: { photoMedia: typeof publicMediaInclude } }>,
  excludeMocks = false,
): ProfessionalSummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    title: record.title,
    photo: media(record.photoMedia, 'image', excludeMocks),
  };
}
function summary(record: ArticleRecord, excludeMocks = false): PublicArticleSummary {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt,
    type: record.type,
    featured: record.featured,
    publishedAt: record.publishedAt?.toISOString() ?? '',
    updatedAt: record.updatedAt.toISOString(),
    readingTimeMinutes: record.readingTimeMinutes,
    author:
      record.author.isActive && (!excludeMocks || !record.author.isMock)
        ? professionalSummary(record.author, excludeMocks)
        : null,
    cover: media(record.coverMedia, 'image', excludeMocks),
    categories: record.categories
      .filter((row) => row.category.isActive && (!excludeMocks || !row.category.isMock))
      .map((row) => taxonomy(row.category)),
    tags: record.tags
      .filter((row) => row.tag.isActive && (!excludeMocks || !row.tag.isMock))
      .map((row) => taxonomy(row.tag)),
    practiceAreas: record.practiceAreas
      .filter((row) => row.practiceArea.isActive && (!excludeMocks || !row.practiceArea.isMock))
      .map((row) => taxonomy(row.practiceArea)),
  };
}
function detail(record: ArticleRecord, excludeMocks = false): PublicArticle {
  return {
    ...summary(record, excludeMocks),
    content: publicContent(record.content),
    pdf: media(record.pdfMedia, 'pdf', excludeMocks),
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
  };
}
function admin(record: ArticleRecord) {
  return {
    ...detail(record),
    status: record.status,
    version: record.version,
    createdById: record.createdById,
    updatedById: record.updatedById,
    authorId: record.authorId,
    coverMediaId: record.coverMediaId,
    pdfMediaId: record.pdfMediaId,
    categoryIds: record.categories.map((row) => row.categoryId),
    tagIds: record.tags.map((row) => row.tagId),
    practiceAreaIds: record.practiceAreas.map((row) => row.practiceAreaId),
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    isMock: record.isMock,
  };
}
function filters(query: ArticleQueryDto): Prisma.ArticleWhereInput {
  if (query.author && query.professional && query.author !== query.professional)
    throw new BadRequestException();
  const author = query.professional ?? query.author;
  return {
    ...(query.area
      ? { practiceAreas: { some: { practiceArea: { slug: query.area, isActive: true } } } }
      : {}),
    ...(query.category
      ? { categories: { some: { category: { slug: query.category, isActive: true } } } }
      : {}),
    ...(query.tag ? { tags: { some: { tag: { slug: query.tag, isActive: true } } } } : {}),
    ...(author ? { author: { slug: author, isActive: true } } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.year
      ? {
          publishedAt: {
            gte: new Date(Date.UTC(query.year, 0, 1)),
            lt: new Date(Date.UTC(query.year + 1, 0, 1)),
          },
        }
      : {}),
  };
}
function order(query: ArticleQueryDto): Prisma.ArticleOrderByWithRelationInput[] {
  const sort = requireSort(query, ['newest', 'oldest', 'title'], 'newest');
  return [
    sort === 'title'
      ? { title: 'asc' }
      : { publishedAt: { sort: sort === 'oldest' ? 'asc' : 'desc', nulls: 'last' } },
    { id: 'asc' },
  ];
}
const publicWhere = (now = new Date(), excludeMocks = false): Prisma.ArticleWhereInput => ({
  status: PublicationStatus.PUBLISHED,
  publishedAt: { lte: now },
  author: { isActive: true, ...(excludeMocks ? { isMock: false } : {}) },
  ...(excludeMocks ? { isMock: false } : {}),
});

@Injectable()
export class ArticlesService {
  constructor(
    private readonly db: PrismaService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  async publicFilters(): Promise<PublicEditorialFilters> {
    const now = new Date();
    const excludeMocks = this.environment.APP_ENV === 'production';
    const where = publicWhere(now, excludeMocks);
    const eligible = { isActive: true, ...(excludeMocks ? { isMock: false } : {}) };
    const select = { id: true, slug: true, name: true } as const;
    const orderBy = [{ name: 'asc' }, { id: 'asc' }] as const;
    const [areas, categories, authors, tags, years] = await this.db.$transaction(
      [
        this.db.practiceArea.findMany({
          where: { ...eligible, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.category.findMany({
          where: { ...eligible, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.professional.findMany({
          where: { ...eligible, articles: { some: where } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.tag.findMany({
          where: { ...eligible, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.$queryRaw<{ year: number }[]>`
          SELECT DISTINCT EXTRACT(YEAR FROM a.published_at AT TIME ZONE 'UTC')::integer AS year
          FROM articles a JOIN professionals p ON p.id = a.author_id
          WHERE a.status = 'PUBLISHED' AND a.published_at <= ${now} AND p.is_active = TRUE
            AND (${!excludeMocks} OR (a.is_mock = FALSE AND p.is_mock = FALSE))
          ORDER BY year DESC
        `,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { areas, categories, authors, tags, years: years.map((row) => row.year) };
  }
  async publicList(query: ArticleQueryDto) {
    const excludeMocks = this.environment.APP_ENV === 'production';
    const where: Prisma.ArticleWhereInput = {
      AND: [publicWhere(new Date(), excludeMocks), filters(query)],
    };
    const [records, total] = await this.db.$transaction([
      this.db.article.findMany({ where, include, ...paging(query), orderBy: order(query) }),
      this.db.article.count({ where }),
    ]);
    return paginated(
      records.map((record) => summary(record, excludeMocks)),
      total,
      query,
    );
  }
  async publicDetail(slug: string) {
    const excludeMocks = this.environment.APP_ENV === 'production';
    return detail(
      exists(
        await this.db.article.findFirst({
          where: { AND: [publicWhere(new Date(), excludeMocks), { slug }] },
          include,
        }),
      ),
      excludeMocks,
    );
  }
  async adminList(query: AdminArticleQueryDto, actor: Actor) {
    const where: Prisma.ArticleWhereInput = {
      AND: [
        filters(query),
        actor.role === UserRole.AUTHOR
          ? { createdById: actor.id, status: PublicationStatus.DRAFT }
          : query.status
            ? { status: query.status }
            : {},
      ],
    };
    const [records, total] = await this.db.$transaction([
      this.db.article.findMany({ where, include, ...paging(query), orderBy: order(query) }),
      this.db.article.count({ where }),
    ]);
    return paginated(records.map(admin), total, query);
  }
  private authorize(record: { createdById: string; status: PublicationStatus }, actor: Actor) {
    if (
      actor.role === UserRole.AUTHOR &&
      (record.createdById !== actor.id || record.status !== PublicationStatus.DRAFT)
    )
      throw new ForbiddenException({ code: 'CONTENT_FORBIDDEN' });
  }
  async adminDetail(id: string, actor: Actor) {
    const record = exists(await this.db.article.findUnique({ where: { id }, include }));
    this.authorize(record, actor);
    return admin(record);
  }
  async create(dto: ArticleDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await validateRelations(tx, dto);
        await validateMedia(tx, dto.coverMediaId, 'image');
        await validateMedia(tx, dto.pdfMediaId, 'pdf');
        if (dto.pdfMediaId && dto.type !== 'GUIDE')
          throw new BadRequestException({ code: 'INVALID_RELATION' });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        if (await tx.redirect.findUnique({ where: { sourcePath: `/conteudos/${dto.slug}` } }))
          throw new BadRequestException({ code: 'SLUG_RESERVED' });
        const record = await tx.article.create({
          data: {
            title: dto.title,
            slug: dto.slug,
            excerpt: dto.excerpt,
            content: json(dto.content),
            type: dto.type,
            authorId: dto.authorId,
            createdById: actor.id,
            updatedById: actor.id,
            coverMediaId: dto.coverMediaId,
            pdfMediaId: dto.pdfMediaId,
            featured: dto.featured,
            seoTitle: dto.seoTitle,
            seoDescription: dto.seoDescription,
            readingTimeMinutes: Math.max(
              1,
              Math.ceil(plainText(dto.content).split(/\s+/u).filter(Boolean).length / 200),
            ),
            isMock: this.environment.MOCK_CONTENT,
            categories: { create: (dto.categoryIds ?? []).map((categoryId) => ({ categoryId })) },
            tags: { create: (dto.tagIds ?? []).map((tagId) => ({ tagId })) },
            practiceAreas: {
              create: (dto.practiceAreaIds ?? []).map((practiceAreaId) => ({ practiceAreaId })),
            },
          },
          include,
        });
        await audit(tx, actor.id, 'article.created', 'article', record.id);
        return admin(record);
      }),
    );
  }
  async update(id: string, dto: ArticlePatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        const current = exists(await tx.article.findUnique({ where: { id } }));
        this.authorize(current, actor);
        await validateRelations(tx, dto);
        await validateMedia(tx, dto.coverMediaId, 'image');
        await validateMedia(tx, dto.pdfMediaId, 'pdf');
        if (
          (dto.pdfMediaId ?? (dto.pdfMediaId === null ? null : current.pdfMediaId)) &&
          (dto.type ?? current.type) !== 'GUIDE'
        )
          throw new BadRequestException({ code: 'INVALID_RELATION' });
        if (dto.slug && dto.slug !== current.slug)
          await preserveSlug(
            tx,
            `/conteudos/${current.slug}`,
            `/conteudos/${dto.slug}`,
            current.status === PublicationStatus.PUBLISHED &&
              current.publishedAt !== null &&
              current.publishedAt <= new Date(),
          );
        versionUpdated(
          (
            await tx.article.updateMany({
              where: {
                id,
                version: dto.version,
                ...(actor.role === UserRole.AUTHOR
                  ? { createdById: actor.id, status: PublicationStatus.DRAFT }
                  : {}),
              },
              data: {
                title: dto.title,
                slug: dto.slug,
                excerpt: dto.excerpt,
                ...(dto.content === undefined
                  ? {}
                  : {
                      content: json(dto.content),
                      readingTimeMinutes: Math.max(
                        1,
                        Math.ceil(
                          plainText(dto.content).split(/\s+/u).filter(Boolean).length / 200,
                        ),
                      ),
                    }),
                type: dto.type,
                authorId: dto.authorId,
                coverMediaId: dto.coverMediaId,
                pdfMediaId: dto.pdfMediaId,
                featured: dto.featured,
                seoTitle: dto.seoTitle,
                seoDescription: dto.seoDescription,
                updatedById: actor.id,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        if (dto.categoryIds) {
          await tx.articleCategory.deleteMany({ where: { articleId: id } });
          await tx.articleCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({ articleId: id, categoryId })),
          });
        }
        if (dto.tagIds) {
          await tx.articleTag.deleteMany({ where: { articleId: id } });
          await tx.articleTag.createMany({
            data: dto.tagIds.map((tagId) => ({ articleId: id, tagId })),
          });
        }
        if (dto.practiceAreaIds) {
          await tx.articlePracticeArea.deleteMany({ where: { articleId: id } });
          await tx.articlePracticeArea.createMany({
            data: dto.practiceAreaIds.map((practiceAreaId) => ({ articleId: id, practiceAreaId })),
          });
        }
        await audit(tx, actor.id, 'article.updated', 'article', id);
        if (current.status === PublicationStatus.PUBLISHED)
          await queueRevalidation(tx, [
            `/conteudos/${current.slug}`,
            `/conteudos/${dto.slug ?? current.slug}`,
          ]);
        return admin(exists(await tx.article.findUnique({ where: { id }, include })));
      }),
    );
  }
  async publication(id: string, dto: PublicationDto, actor: Actor) {
    if (actor.role === UserRole.AUTHOR) throw new ForbiddenException({ code: 'CONTENT_FORBIDDEN' });
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const record = exists(await tx.article.findUnique({ where: { id }, include }));
        if (dto.status === 'PUBLISHED' || dto.status === 'SCHEDULED') {
          if (!plainText(publicContent(record.content)).trim())
            throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
          await validateRelations(tx, {
            authorId: record.authorId,
            categoryIds: record.categories.map((row) => row.categoryId),
            tagIds: record.tags.map((row) => row.tagId),
            practiceAreaIds: record.practiceAreas.map((row) => row.practiceAreaId),
          });
          await validateMedia(tx, record.coverMediaId, 'image');
          await validateMedia(tx, record.pdfMediaId, 'pdf');
        }
        const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
        if (
          dto.status === 'SCHEDULED' &&
          (!scheduledAt ||
            !Number.isFinite(scheduledAt.getTime()) ||
            scheduledAt.getTime() <= Date.now() ||
            !dto.scheduledAt?.endsWith('Z'))
        )
          throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
        if (dto.status !== 'SCHEDULED' && dto.scheduledAt !== undefined)
          throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
        versionUpdated(
          (
            await tx.article.updateMany({
              where: { id, version: dto.version },
              data: {
                status: dto.status,
                publishedAt: dto.status === 'PUBLISHED' ? (record.publishedAt ?? new Date()) : null,
                scheduledAt: dto.status === 'SCHEDULED' ? scheduledAt : null,
                version: { increment: 1 },
                updatedById: actor.id,
              },
            })
          ).count,
        );
        await audit(tx, actor.id, `article.${dto.status.toLowerCase()}`, 'article', id);
        await tx.previewToken.updateMany({
          where: { articleId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await queueRevalidation(tx, [`/conteudos/${record.slug}`]);
        return admin(exists(await tx.article.findUnique({ where: { id }, include })));
      }),
    );
  }
  private previewHash(token: string) {
    return createHmac('sha256', this.environment.PREVIEW_SECRET).update(token).digest('hex');
  }
  async issuePreview(id: string, version: number, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM articles WHERE id = ${id}::uuid FOR UPDATE`;
      const row = exists(await tx.article.findUnique({ where: { id } }));
      this.authorize(row, actor);
      versionUpdated(row.version === version ? 1 : 0);
      const now = new Date();
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + this.environment.PREVIEW_TTL_SECONDS * 1000);
      await tx.previewToken.updateMany({
        where: { articleId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.previewToken.create({
        data: {
          articleId: id,
          createdById: actor.id,
          tokenHash: this.previewHash(token),
          expiresAt,
        },
      });
      await audit(tx, actor.id, 'article.preview.created', 'article', id);
      return { token, expiresAt: expiresAt.toISOString() };
    });
  }
  async revokePreview(id: string, version: number, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM articles WHERE id = ${id}::uuid FOR UPDATE`;
      const row = exists(await tx.article.findUnique({ where: { id } }));
      this.authorize(row, actor);
      versionUpdated(row.version === version ? 1 : 0);
      await tx.previewToken.updateMany({
        where: { articleId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(tx, actor.id, 'article.preview.revoked', 'article', id);
      return { revoked: true };
    });
  }
  async preview(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return exists(null);
    const row = exists(
      await this.db.previewToken.findFirst({
        where: {
          tokenHash: this.previewHash(token),
          revokedAt: null,
          expiresAt: { gt: new Date() },
          createdBy: { isActive: true },
        },
        include: { article: { include }, createdBy: { select: { role: true } } },
      }),
    );
    if (
      row.createdBy.role === UserRole.AUTHOR &&
      (row.article.createdById !== row.createdById ||
        row.article.status !== PublicationStatus.DRAFT)
    )
      return exists(null);
    return {
      article: {
        ...detail(row.article),
        publishedAt: row.article.publishedAt?.toISOString() ?? row.article.updatedAt.toISOString(),
      },
      expiresAt: row.expiresAt.toISOString(),
    };
  }
  async publishDue(now = new Date()) {
    return this.db.$transaction(
      async (tx) => {
        const locks = await tx.$queryRaw<
          { acquired: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(6006002) AS acquired`;
        if (!locks[0]?.acquired) return 0;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM articles WHERE status = 'SCHEDULED' AND scheduled_at <= ${now} ORDER BY scheduled_at, id FOR UPDATE SKIP LOCKED LIMIT 50`;
        let published = 0;
        for (const { id } of ids) {
          const record = exists(await tx.article.findUnique({ where: { id }, include }));
          try {
            if (!plainText(publicContent(record.content)).trim()) throw new BadRequestException();
            const issuer = record.updatedById
              ? await tx.user.findUnique({ where: { id: record.updatedById } })
              : null;
            if (!issuer?.isActive || issuer.role === UserRole.AUTHOR)
              throw new BadRequestException();
            await validateRelations(tx, {
              authorId: record.authorId,
              categoryIds: record.categories.map((r) => r.categoryId),
              tagIds: record.tags.map((r) => r.tagId),
              practiceAreaIds: record.practiceAreas.map((r) => r.practiceAreaId),
            });
            await validateMedia(tx, record.coverMediaId, 'image');
            await validateMedia(tx, record.pdfMediaId, 'pdf');
          } catch (error) {
            if (!(error instanceof BadRequestException)) throw error;
            await tx.article.update({
              where: { id },
              data: {
                status: 'DRAFT',
                scheduledAt: null,
                publishedAt: null,
                version: { increment: 1 },
              },
            });
            await tx.auditEvent.create({
              data: { action: 'article.schedule.rejected', resource: 'article', resourceId: id },
            });
            continue;
          }
          await tx.article.update({
            where: { id },
            data: {
              status: 'PUBLISHED',
              scheduledAt: null,
              publishedAt: now,
              version: { increment: 1 },
            },
          });
          await tx.previewToken.updateMany({
            where: { articleId: id, revokedAt: null },
            data: { revokedAt: now },
          });
          await tx.auditEvent.create({
            data: { action: 'article.scheduled.published', resource: 'article', resourceId: id },
          });
          await queueRevalidation(tx, [`/conteudos/${record.slug}`]);
          published++;
        }
        return published;
      },
      { timeout: 30000 },
    );
  }
  async remove(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const record = exists(await tx.article.findUnique({ where: { id } }));
        this.authorize(record, actor);
        if (
          record.status === PublicationStatus.PUBLISHED ||
          record.status === PublicationStatus.SCHEDULED
        )
          throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
        versionUpdated((await tx.article.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'article.deleted', 'article', id);
        return { deleted: true };
      }),
    );
  }
}
