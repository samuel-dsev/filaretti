import type { ArticleType } from '@filaretti/types';

import { publicPageNumber } from './public-routing';

export interface EditorialQuery {
  page: number;
  area?: string;
  category?: string;
  professional?: string;
  tag?: string;
  type?: ArticleType;
  year?: number;
  sort: 'newest' | 'oldest' | 'title';
}

type SearchParams = Record<string, string | string[] | undefined>;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function slug(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length <= 120 && slugPattern.test(value)
    ? value
    : undefined;
}

/** Normalize URL inputs before calling the validated API. Repeated/invalid values are ignored. */
export function parseEditorialQuery(params: SearchParams): EditorialQuery {
  const type = params.tipo;
  const year =
    typeof params.ano === 'string' && /^\d{4}$/u.test(params.ano) ? Number(params.ano) : undefined;
  return {
    page: publicPageNumber(params.pagina),
    area: slug(params.area),
    category: slug(params.categoria),
    professional: slug(params.autor),
    tag: slug(params.tag),
    type:
      typeof type === 'string' && ['ARTICLE', 'UPDATE', 'GUIDE'].includes(type)
        ? (type as ArticleType)
        : undefined,
    year: year !== undefined && year >= 1900 && year <= 2100 ? year : undefined,
    sort: params.ordem === 'oldest' || params.ordem === 'title' ? params.ordem : 'newest',
  };
}

/** A single builder keeps filters intact across pagination and copied result links. */
export function editorialHref(query: EditorialQuery, page = query.page): string {
  const params = new URLSearchParams();
  const filters = [
    ['area', query.area],
    ['categoria', query.category],
    ['autor', query.professional],
    ['tag', query.tag],
    ['tipo', query.type],
    ['ano', query.year?.toString()],
  ] as const;
  for (const [name, value] of filters) if (value) params.set(name, value);
  if (query.sort !== 'newest') params.set('ordem', query.sort);
  if (Number.isInteger(page) && page > 1 && page <= 100000) params.set('pagina', String(page));
  const search = params.toString();
  return search ? `/conteudos?${search}` : '/conteudos';
}
