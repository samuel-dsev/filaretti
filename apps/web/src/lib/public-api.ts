import 'server-only';

import { cache } from 'react';

import { createPublicApiClient, type ArticleQuery, type PaginationQuery } from './public-api-core';

export { PublicApiError } from './public-api-core';
export type { PublicApiErrorCode, PaginationQuery, ArticleQuery } from './public-api-core';

// React cache deduplicates only within a server render; fetch never uses persistent Next data cache.
const client = cache(() => createPublicApiClient({ baseUrl: process.env.API_INTERNAL_URL ?? '' }));

export const getSettings = cache(() => client().getSettings());
export const getPage = cache((slug: string) => client().getPage(slug));
export const getPracticeArea = cache((slug: string) => client().getPracticeArea(slug));
export const getProfessional = cache((slug: string) => client().getProfessional(slug));

const practiceAreas = cache((page?: number, limit?: number) =>
  client().getPracticeAreas({ page, limit }),
);
const professionals = cache((page?: number, limit?: number) =>
  client().getProfessionals({ page, limit }),
);
const articles = cache(
  (
    page?: number,
    limit?: number,
    area?: string,
    professional?: string,
    type?: ArticleQuery['type'],
    featured?: boolean,
  ) => client().getArticles({ page, limit, area, professional, type, featured }),
);

export function getPracticeAreas({ page, limit }: PaginationQuery = {}) {
  return practiceAreas(page, limit);
}
export function getProfessionals({ page, limit }: PaginationQuery = {}) {
  return professionals(page, limit);
}
export function getArticles({
  page,
  limit,
  area,
  professional,
  type,
  featured,
}: ArticleQuery = {}) {
  return articles(page, limit, area, professional, type, featured);
}
