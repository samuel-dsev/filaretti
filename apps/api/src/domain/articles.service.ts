import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
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
): ProfessionalSummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    title: record.title,
    photo: media(record.photoMedia, 'image'),
  };
}
function summary(record: ArticleRecord): PublicArticleSummary {
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
    author: record.author.isActive ? professionalSummary(record.author) : null,
    cover: media(record.coverMedia, 'image'),
    categories: record.categories
      .filter((row) => row.category.isActive)
      .map((row) => taxonomy(row.category)),
    tags: record.tags.filter((row) => row.tag.isActive).map((row) => taxonomy(row.tag)),
    practiceAreas: record.practiceAreas
      .filter((row) => row.practiceArea.isActive)
      .map((row) => taxonomy(row.practiceArea)),
  };
}
function detail(record: ArticleRecord): PublicArticle {
  return {
    ...summary(record),
    content: publicContent(record.content),
    pdf: media(record.pdfMedia, 'pdf'),
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
const publicWhere = (now = new Date()): Prisma.ArticleWhereInput => ({
  status: PublicationStatus.PUBLISHED,
  publishedAt: { lte: now },
  author: { isActive: true },
});

@Injectable()
export class ArticlesService {
  constructor(
    private readonly db: PrismaService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  async publicFilters(): Promise<PublicEditorialFilters> {
    const now = new Date();
    const where = publicWhere(now);
    const select = { id: true, slug: true, name: true } as const;
    const orderBy = [{ name: 'asc' }, { id: 'asc' }] as const;
    const [areas, categories, authors, tags, years] = await this.db.$transaction(
      [
        this.db.practiceArea.findMany({
          where: { isActive: true, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.category.findMany({
          where: { isActive: true, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.professional.findMany({
          where: { isActive: true, articles: { some: where } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.tag.findMany({
          where: { isActive: true, articles: { some: { article: where } } },
          select,
          orderBy: [...orderBy],
        }),
        this.db.$queryRaw<{ year: number }[]>`
          SELECT DISTINCT EXTRACT(YEAR FROM a.published_at AT TIME ZONE 'UTC')::integer AS year
          FROM articles a JOIN professionals p ON p.id = a.author_id
          WHERE a.status = 'PUBLISHED' AND a.published_at <= ${now} AND p.is_active = TRUE
          ORDER BY year DESC
        `,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { areas, categories, authors, tags, years: years.map((row) => row.year) };
  }
  async publicList(query: ArticleQueryDto) {
    const where: Prisma.ArticleWhereInput = { AND: [publicWhere(), filters(query)] };
    const [records, total] = await this.db.$transaction([
      this.db.article.findMany({ where, include, ...paging(query), orderBy: order(query) }),
      this.db.article.count({ where }),
    ]);
    return paginated(records.map(summary), total, query);
  }
  async publicDetail(slug: string) {
    return detail(
      exists(
        await this.db.article.findFirst({ where: { AND: [publicWhere(), { slug }] }, include }),
      ),
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
        const current = exists(await tx.article.findUnique({ where: { id } }));
        this.authorize(current, actor);
        await validateRelations(tx, dto);
        await validateMedia(tx, dto.coverMediaId, 'image');
        await validateMedia(tx, dto.pdfMediaId, 'pdf');
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
        return admin(exists(await tx.article.findUnique({ where: { id }, include })));
      }),
    );
  }
  async publication(id: string, dto: PublicationDto, actor: Actor) {
    if (actor.role === UserRole.AUTHOR) throw new ForbiddenException({ code: 'CONTENT_FORBIDDEN' });
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const record = exists(await tx.article.findUnique({ where: { id }, include }));
        if (dto.status === 'PUBLISHED') {
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
        versionUpdated(
          (
            await tx.article.updateMany({
              where: { id, version: dto.version },
              data: {
                status: dto.status,
                publishedAt: dto.status === 'PUBLISHED' ? (record.publishedAt ?? new Date()) : null,
                scheduledAt: null,
                version: { increment: 1 },
                updatedById: actor.id,
              },
            })
          ).count,
        );
        await audit(tx, actor.id, `article.${dto.status.toLowerCase()}`, 'article', id);
        return admin(exists(await tx.article.findUnique({ where: { id }, include })));
      }),
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
