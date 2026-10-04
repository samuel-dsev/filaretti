/** Public search never includes administrative data, unpublished content or private media. */
export type SearchKind = 'article' | 'area' | 'professional';

export interface PublicSearchQuery {
  q: string;
  kind?: SearchKind | 'all';
  page?: number;
  limit?: number;
}

export interface PublicSearchResult {
  kind: SearchKind;
  slug: string;
  title: string;
  excerpt: string;
  href: string;
}

export interface PublicSitemapEntry {
  path: string;
  updatedAt: string;
}
