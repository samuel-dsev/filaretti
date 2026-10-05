export type PublicRouteResource = { endpoint: string; isDetail: boolean };

/** The API owns publication/visibility. The Proxy only translates HTTP status before streaming. */
export function publicRouteResource(pathname: string): PublicRouteResource | null {
  if (pathname === '/') return { endpoint: '/pages/home', isDetail: true };
  if (pathname === '/o-escritorio') return { endpoint: '/pages/o-escritorio', isDetail: true };
  if (pathname === '/areas-de-atuacao') {
    return { endpoint: '/practice-areas?limit=1', isDetail: false };
  }
  if (pathname === '/profissionais') {
    return { endpoint: '/professionals?limit=1', isDetail: false };
  }
  if (pathname === '/conteudos') return { endpoint: '/articles?limit=1', isDetail: false };
  if (pathname === '/busca') return { endpoint: '/public/search?q=site&limit=1', isDetail: false };
  if (pathname === '/perguntas-frequentes') return { endpoint: '/faqs?limit=1', isDetail: false };
  const match = /^\/(areas-de-atuacao|profissionais|conteudos)\/([^/]+)$/u.exec(pathname);
  if (!match) return null;
  const slug = match[2];
  if (!slug || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    return { endpoint: '', isDetail: true };
  }
  const collection =
    match[1] === 'areas-de-atuacao'
      ? 'practice-areas'
      : match[1] === 'profissionais'
        ? 'professionals'
        : 'articles';
  return { endpoint: `/${collection}/${slug}`, isDetail: true };
}

/** Only a bounded public detail path may preload an article in the institutional layout. */
export function publicArticleSlug(pathname: string): string | null {
  const resource = publicRouteResource(pathname);
  if (!resource?.isDetail || !resource.endpoint.startsWith('/articles/')) return null;
  return resource.endpoint.slice('/articles/'.length);
}

export function publicPageNumber(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/u.test(value)) return 1;
  const page = Number(value);
  return page <= 100000 ? page : 1;
}
