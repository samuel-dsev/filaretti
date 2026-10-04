import Link from 'next/link';
import { EmptyState, Pagination } from '@filaretti/ui';
import type { PublicSearchQuery, SearchKind } from '@filaretti/types';
import { Breadcrumb, Hero } from '@/components/site';
import { SearchForm } from '@/components/search/search-form';
import styles from '@/components/search/search.module.css';
import { searchPublic } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';
import { publicPageNumber } from '@/lib/public-routing';

export const metadata = publicMetadata({ title: 'Busca', path: '/busca', noIndex: true });
const labels: Record<SearchKind, string> = {
  article: 'Conteúdo',
  area: 'Área de atuação',
  professional: 'Profissional',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.q === 'string' ? params.q.trim() : '';
  const valid = raw.length >= 2 && raw.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(raw);
  const kind: PublicSearchQuery['kind'] =
    params.kind === 'article' || params.kind === 'area' || params.kind === 'professional'
      ? params.kind
      : 'all';
  const query: PublicSearchQuery = {
    q: raw.slice(0, 120),
    kind,
    page: publicPageNumber(params.pagina),
    limit: 12,
  };
  const results = valid ? await searchPublic(query) : null;
  const href = (page: number) =>
    `/busca?${new URLSearchParams({ q: query.q, kind: kind ?? 'all', pagina: String(page) })}`;
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Busca' }]} />
      </div>
      <Hero
        eyebrow="Explore o site"
        title="Busca"
        description="Encontre conteúdos, áreas de atuação e profissionais."
      />
      <div className="f-container institution-index-content">
        <SearchForm query={query} />
        <p id="search-help" className={styles.help}>
          Use de 2 a 120 caracteres. Os resultados consideram somente informações publicadas.
        </p>
        {results ? (
          <>
            <p role="status" className="institution-result-count">
              {results.meta.total}{' '}
              {results.meta.total === 1 ? 'resultado encontrado' : 'resultados encontrados'}
            </p>
            {results.data.length ? (
              <ol className={styles.results}>
                {results.data.map((result) => (
                  <li key={`${result.kind}-${result.slug}`} className={styles.result}>
                    <span className={styles.kindLabel}>{labels[result.kind]}</span>
                    <h2>
                      <Link href={result.href} prefetch={false}>
                        {result.title}
                      </Link>
                    </h2>
                    <p>{result.excerpt}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Nenhum resultado nesta página"
                description="Tente outra palavra ou selecione todo o site."
              />
            )}
            <Pagination
              currentPage={results.meta.page}
              totalPages={results.meta.pages}
              getHref={href}
              className="institution-pagination"
            />
          </>
        ) : (
          <EmptyState
            title={raw ? 'Revise o termo da busca' : 'Comece por uma palavra'}
            description="Informe um assunto no campo acima para consultar o site."
          />
        )}
      </div>
    </>
  );
}
