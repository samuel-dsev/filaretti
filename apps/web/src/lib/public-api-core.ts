import type {
  ArticleType,
  PaginatedResponse,
  ProfessionalSummary,
  PublicArticle,
  PublicArticleSummary,
  PublicEditorialFilters,
  PublicMedia,
  PublicPage,
  PublicPracticeArea,
  PublicProfessional,
  PublicSiteSettings,
  TaxonomySummary,
  TipTapDocument,
} from '@filaretti/types';

import { parsePublicDocument, safeMediaUrl, safePublicUrl } from './public-content-core';

export type PublicApiErrorCode = 'NOT_FOUND' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

const errorMessages: Record<PublicApiErrorCode, string> = {
  NOT_FOUND: 'Conteúdo não encontrado.',
  UNAVAILABLE: 'O conteúdo está temporariamente indisponível.',
  INVALID_RESPONSE: 'Não foi possível carregar o conteúdo.',
};

export class PublicApiError extends Error {
  readonly code: PublicApiErrorCode;
  constructor(code: PublicApiErrorCode) {
    super(errorMessages[code]);
    this.name = 'PublicApiError';
    this.code = code;
  }
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
export interface ArticleQuery extends PaginationQuery {
  area?: string;
  professional?: string;
  category?: string;
  tag?: string;
  year?: number;
  sort?: 'newest' | 'oldest' | 'title';
  type?: ArticleType;
  featured?: boolean;
}

export interface PublicApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

function invalid(): never {
  throw new PublicApiError('INVALID_RESPONSE');
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length > 50000) return invalid();
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    return invalid();
  return value;
}
function array<T>(value: unknown, decode: (item: unknown) => T, max = 2000): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid();
  return value.map(decode);
}
function document(value: unknown): TipTapDocument {
  return parsePublicDocument(value) ?? invalid();
}
function taxonomy(value: unknown): TaxonomySummary {
  const item = record(value);
  return { id: text(item.id), slug: text(item.slug), name: text(item.name) };
}
function media(value: unknown, kind: 'image' | 'pdf' = 'image'): PublicMedia | null {
  if (value === null) return null;
  const item = record(value);
  const url = safeMediaUrl(text(item.url));
  const mimeType = text(item.mimeType);
  const extension = kind === 'pdf' ? /\.pdf$/iu : /\.(?:jpe?g|png|webp|avif)$/iu;
  if (
    !url ||
    (url.startsWith('/') &&
      (!url.startsWith('/media/public/') ||
        /[?#]/u.test(url) ||
        url
          .slice(1)
          .split('/')
          .some((part) => part === '.' || part === '..' || part === '') ||
        !extension.test(url))) ||
    !(
      kind === 'pdf' ? ['application/pdf'] : ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    ).includes(mimeType)
  )
    return null;
  return {
    id: text(item.id),
    alt: nullableText(item.alt),
    mimeType,
    size: integer(item.size, 1),
    url,
  };
}
function professionalSummary(value: unknown): ProfessionalSummary {
  const item = record(value);
  return {
    id: text(item.id),
    slug: text(item.slug),
    name: text(item.name),
    title: text(item.title),
    photo: media(item.photo),
  };
}
function professional(value: unknown): PublicProfessional {
  const item = record(value);
  return {
    ...professionalSummary(item),
    bio: document(item.bio),
    education: array(item.education, text),
    experience: array(item.experience, text),
    practiceAreas: array(item.practiceAreas, taxonomy),
  };
}
function area(value: unknown): PublicPracticeArea {
  const item = record(value);
  return {
    ...taxonomy(item),
    summary: text(item.summary),
    description: document(item.description),
    services: array(item.services, text),
    professionals: array(item.professionals, professionalSummary),
  };
}
function page(value: unknown): PublicPage {
  const item = record(value);
  return {
    id: text(item.id),
    slug: text(item.slug),
    title: text(item.title),
    seoTitle: nullableText(item.seoTitle),
    seoDescription: nullableText(item.seoDescription),
    sections: array(
      item.sections,
      (value) => {
        const section = record(value);
        return {
          key: text(section.key),
          ...(section.heading === undefined ? {} : { heading: text(section.heading) }),
          body: document(section.body),
        };
      },
      30,
    ),
  };
}
function article(value: unknown): PublicArticleSummary {
  const item = record(value);
  if (
    !['ARTICLE', 'UPDATE', 'GUIDE'].includes(text(item.type)) ||
    typeof item.featured !== 'boolean'
  )
    return invalid();
  const publishedAt = text(item.publishedAt);
  const updatedAt = text(item.updatedAt);
  if (!Number.isFinite(Date.parse(publishedAt)) || !Number.isFinite(Date.parse(updatedAt)))
    return invalid();
  return {
    id: text(item.id),
    slug: text(item.slug),
    title: text(item.title),
    excerpt: text(item.excerpt),
    type: item.type as ArticleType,
    featured: item.featured,
    publishedAt,
    updatedAt,
    readingTimeMinutes: integer(item.readingTimeMinutes),
    author: item.author === null ? null : professionalSummary(item.author),
    cover: media(item.cover),
    categories: array(item.categories, taxonomy),
    tags: array(item.tags, taxonomy),
    practiceAreas: array(item.practiceAreas, taxonomy),
  };
}
function articleDetail(value: unknown): PublicArticle {
  const item = record(value);
  return {
    ...article(item),
    content: document(item.content),
    pdf: media(item.pdf, 'pdf'),
    seoTitle: nullableText(item.seoTitle),
    seoDescription: nullableText(item.seoDescription),
  };
}
function editorialFilters(value: unknown): PublicEditorialFilters {
  const item = record(value);
  // Facets describe the whole catalog; never truncate them to the list page size.
  return {
    areas: array(item.areas, taxonomy, Number.MAX_SAFE_INTEGER),
    categories: array(item.categories, taxonomy, Number.MAX_SAFE_INTEGER),
    authors: array(item.authors, taxonomy, Number.MAX_SAFE_INTEGER),
    tags: array(item.tags, taxonomy, Number.MAX_SAFE_INTEGER),
    years: array(item.years, (value) => integer(value), Number.MAX_SAFE_INTEGER),
  };
}
function settings(value: unknown): PublicSiteSettings {
  const item = record(value);
  const addressValue = record(item.address);
  const address: Record<string, string> = {};
  for (const key of ['street', 'city', 'state', 'postalCode', 'country']) {
    if (addressValue[key] !== undefined) address[key] = text(addressValue[key]);
  }
  const socialLinks = array(
    item.socialLinks,
    (value) => {
      const link = record(value);
      const label = text(link.label);
      const url = safePublicUrl(text(link.url));
      return url ? { label, url } : null;
    },
    50,
  ).filter((link): link is { label: string; url: string } => link !== null);
  return {
    siteName: text(item.siteName),
    publicEmail: nullableText(item.publicEmail),
    publicPhone: nullableText(item.publicPhone),
    whatsappUrl: safePublicUrl(nullableText(item.whatsappUrl)),
    address,
    socialLinks,
  };
}
function paginated<T>(value: unknown, decode: (item: unknown) => T): PaginatedResponse<T> {
  const item = record(value);
  const meta = record(item.meta);
  const limit = integer(meta.limit, 1, 50);
  const total = integer(meta.total);
  const pages = integer(meta.pages);
  const data = array(item.data, decode, limit);
  if (pages !== Math.ceil(total / limit) || data.length > total) return invalid();
  return { data, meta: { page: integer(meta.page, 1, 100000), limit, total, pages } };
}

function slugPath(slug: string): string {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || slug.length > 120)
    return invalid();
  return encodeURIComponent(slug);
}

export function createPublicApiClient({
  baseUrl,
  fetcher = fetch,
  timeoutMs = 5000,
}: PublicApiClientOptions) {
  let origin: URL;
  try {
    origin = new URL(baseUrl);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      throw new Error();
  } catch {
    throw new PublicApiError('UNAVAILABLE');
  }
  const timeout = Number.isFinite(timeoutMs)
    ? Math.min(10000, Math.max(100, Math.floor(timeoutMs)))
    : 5000;

  async function request<T>(path: string, decode: (value: unknown) => T): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const url = new URL(`${origin.pathname.replace(/\/$/u, '')}/api/v1/${path}`, origin.origin);
      const response = await fetcher(url, {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 404) throw new PublicApiError('NOT_FOUND');
      if (!response.ok) throw new PublicApiError('UNAVAILABLE');
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        if (controller.signal.aborted) throw new PublicApiError('UNAVAILABLE');
        throw new PublicApiError('INVALID_RESPONSE');
      }
      return decode(value);
    } catch (error) {
      if (error instanceof PublicApiError) throw error;
      throw new PublicApiError('UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }
  function queryString(query: PaginationQuery) {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set('page', String(integer(query.page, 1, 100000)));
    if (query.limit !== undefined) params.set('limit', String(integer(query.limit, 1, 50)));
    return params;
  }
  async function single<T>(path: string, decode: (value: unknown) => T): Promise<T | null> {
    try {
      return await request(path, decode);
    } catch (error) {
      if (error instanceof PublicApiError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }
  return {
    getSettings: () => request('settings', settings),
    getPage: (slug: string) => single(`pages/${slugPath(slug)}`, page),
    getPracticeAreas: (query: PaginationQuery = {}) =>
      request(`practice-areas?${queryString(query)}`, (value) => paginated(value, area)),
    getPracticeArea: (slug: string) => single(`practice-areas/${slugPath(slug)}`, area),
    getProfessionals: (query: PaginationQuery = {}) =>
      request(`professionals?${queryString(query)}`, (value) => paginated(value, professional)),
    getProfessional: (slug: string) => single(`professionals/${slugPath(slug)}`, professional),
    getEditorialFilters: () => request('editorial/filters', editorialFilters),
    getArticle: (slug: string) => single(`articles/${slugPath(slug)}`, articleDetail),
    getArticles: (query: ArticleQuery = {}) => {
      const params = queryString(query);
      for (const key of ['area', 'professional', 'category', 'tag'] as const) {
        const value = query[key];
        if (value !== undefined) params.set(key, slugPath(value));
      }
      if (query.year !== undefined) params.set('year', String(integer(query.year, 1900, 2100)));
      if (query.sort !== undefined) {
        if (!['newest', 'oldest', 'title'].includes(query.sort)) return invalid();
        params.set('sort', query.sort);
      }
      if (query.type !== undefined) {
        if (!['ARTICLE', 'UPDATE', 'GUIDE'].includes(query.type)) return invalid();
        params.set('type', query.type);
      }
      if (query.featured !== undefined) {
        if (typeof query.featured !== 'boolean') return invalid();
        params.set('featured', String(query.featured));
      }
      return request(`articles?${params}`, (value) => paginated(value, article));
    },
  };
}

export type PublicApiClient = ReturnType<typeof createPublicApiClient>;
