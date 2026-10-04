import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import type { PaginatedResponse, PublicSearchResult, PublicSitemapEntry } from '@filaretti/types';
import { PrismaService } from '../database/prisma.service';
import type { PublicSearchDto, SearchPaginationDto } from './dto';

export const SEARCH_ENVIRONMENT = Symbol('SEARCH_ENVIRONMENT');
type Count = { total: bigint };
type SitemapRow = { path: string; updatedAt: Date };

@Injectable()
export class SearchService {
  constructor(
    private readonly db: PrismaService,
    @Inject(SEARCH_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  async search(query: PublicSearchDto): Promise<PaginatedResponse<PublicSearchResult>> {
    const sources: Prisma.Sql[] = [];
    const production = this.environment.APP_ENV === 'production';
    const term = Prisma.sql`websearch_to_tsquery('portuguese', ${query.q})`;
    if (query.kind === 'all' || query.kind === 'article')
      sources.push(Prisma.sql`
      SELECT 'article'::text AS kind, a.slug, a.title, a.excerpt,
        '/conteudos/' || a.slug AS href, ts_rank_cd(a.search_vector, ${term}, 32) AS rank
      FROM articles a INNER JOIN professionals p ON p.id = a.author_id AND p.is_active = true
      WHERE a.status = 'PUBLISHED' AND a.published_at <= CURRENT_TIMESTAMP AND a.search_vector @@ ${term}
        AND (${!production} OR (a.is_mock = false AND p.is_mock = false))`);
    if (query.kind === 'all' || query.kind === 'area')
      sources.push(Prisma.sql`
      SELECT 'area'::text AS kind, slug, name AS title, summary AS excerpt,
        '/areas-de-atuacao/' || slug AS href, ts_rank_cd(search_vector, ${term}, 32) AS rank
      FROM practice_areas WHERE is_active = true AND search_vector @@ ${term} AND (${!production} OR is_mock = false)`);
    if (query.kind === 'all' || query.kind === 'professional')
      sources.push(Prisma.sql`
      SELECT 'professional'::text AS kind, slug, name AS title, title AS excerpt,
        '/profissionais/' || slug AS href, ts_rank_cd(search_vector, ${term}, 32) AS rank
      FROM professionals WHERE is_active = true AND search_vector @@ ${term} AND (${!production} OR is_mock = false)`);
    const catalog = Prisma.sql`WITH matches AS (${Prisma.join(sources, ' UNION ALL ')})`;
    const [data, counts] = await this.db.$transaction(
      [
        this.db.$queryRaw<PublicSearchResult[]>(Prisma.sql`${catalog}
        SELECT kind, slug, title, excerpt, href FROM matches ORDER BY rank DESC, title ASC, kind ASC, slug ASC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
        this.db.$queryRaw<Count[]>(Prisma.sql`${catalog} SELECT COUNT(*) AS total FROM matches`),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return this.paginated(data, Number(counts[0]?.total ?? 0), query);
  }

  async sitemap(query: SearchPaginationDto): Promise<PaginatedResponse<PublicSitemapEntry>> {
    // Published mocks can be exercised locally; production excludes them even if flags are wrong.
    const production = this.environment.APP_ENV === 'production';
    const catalog = Prisma.sql`WITH urls AS (
      SELECT CASE WHEN slug = 'home' THEN '/' ELSE '/' || slug END AS path, updated_at AS "updatedAt"
      FROM pages WHERE status = 'PUBLISHED' AND published_at <= CURRENT_TIMESTAMP
        AND slug IN ('home', 'o-escritorio', 'contato', 'privacidade', 'cookies') AND (${!production} OR is_mock = false)
      UNION ALL SELECT '/areas-de-atuacao/' || slug, updated_at FROM practice_areas WHERE is_active = true AND (${!production} OR is_mock = false)
      UNION ALL SELECT '/profissionais/' || slug, updated_at FROM professionals WHERE is_active = true AND (${!production} OR is_mock = false)
      UNION ALL SELECT '/conteudos/' || a.slug, a.updated_at FROM articles a JOIN professionals p ON p.id = a.author_id
        WHERE a.status = 'PUBLISHED' AND a.published_at <= CURRENT_TIMESTAMP AND p.is_active = true
        AND (${!production} OR (a.is_mock = false AND p.is_mock = false))
      UNION ALL SELECT '/areas-de-atuacao', MAX(updated_at) FROM practice_areas WHERE is_active = true AND (${!production} OR is_mock = false) HAVING COUNT(*) > 0
      UNION ALL SELECT '/profissionais', MAX(updated_at) FROM professionals WHERE is_active = true AND (${!production} OR is_mock = false) HAVING COUNT(*) > 0
      UNION ALL SELECT '/conteudos', MAX(a.updated_at) FROM articles a JOIN professionals p ON p.id = a.author_id
        WHERE a.status = 'PUBLISHED' AND a.published_at <= CURRENT_TIMESTAMP AND p.is_active = true
        AND (${!production} OR (a.is_mock = false AND p.is_mock = false)) HAVING COUNT(*) > 0
      UNION ALL SELECT '/perguntas-frequentes', MAX(f.updated_at) FROM faqs f LEFT JOIN practice_areas pa ON pa.id = f.practice_area_id
        WHERE f.is_active = true AND (f.practice_area_id IS NULL OR pa.is_active = true)
        AND (${!production} OR (f.is_mock = false AND (f.practice_area_id IS NULL OR pa.is_mock = false))) HAVING COUNT(*) > 0
    )`;
    const [rows, counts] = await this.db.$transaction(
      [
        this.db.$queryRaw<SitemapRow[]>(
          Prisma.sql`${catalog} SELECT path, "updatedAt" FROM urls ORDER BY path ASC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ),
        this.db.$queryRaw<Count[]>(Prisma.sql`${catalog} SELECT COUNT(*) AS total FROM urls`),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return this.paginated(
      rows.map((row) => ({ path: row.path, updatedAt: row.updatedAt.toISOString() })),
      Number(counts[0]?.total ?? 0),
      query,
    );
  }

  private paginated<T>(data: T[], total: number, query: SearchPaginationDto): PaginatedResponse<T> {
    return {
      data,
      meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    };
  }
}
