import type {
  PaginationMeta,
  PublicArticleSummary,
  PublicEditorialFilters,
  TaxonomySummary,
} from '@filaretti/types';
import { Button, EmptyState, FormField, LinkButton, Pagination, Select } from '@filaretti/ui';
import { Breadcrumb, Hero } from '@/components/site';
import { editorialHref, type EditorialQuery } from '@/lib/editorial-query';
import { EditorialArticleCard } from './article-card';

function TaxonomyFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: TaxonomySummary[];
}) {
  const absent = value && !options.some((option) => option.slug === value);
  return (
    <FormField id={`filtro-${name}`} label={label}>
      {(props) => (
        <Select {...props} name={name} defaultValue={value ?? ''}>
          <option value="">Todos</option>
          {absent ? <option value={value}>{value} (indisponível no catálogo atual)</option> : null}
          {options.map((option) => (
            <option key={option.id} value={option.slug}>
              {option.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}

export function EditorialIndexView({
  articles,
  pagination,
  filters,
  query,
}: {
  articles: PublicArticleSummary[];
  pagination: PaginationMeta;
  filters: PublicEditorialFilters;
  query: EditorialQuery;
}) {
  const yearAbsent = query.year !== undefined && !filters.years.includes(query.year);
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Conteúdos' }]} />
      </div>
      <Hero
        eyebrow="Publicações"
        title="Conteúdos"
        description="Artigos, atualizações e guias. Explore as publicações por assunto, área de atuação ou autoria."
      />
      <section className="editorial-catalog">
        <div className="f-container">
          <form
            action="/conteudos"
            method="get"
            className="editorial-filters"
            aria-labelledby="filtros-heading"
          >
            <div className="editorial-filter-heading">
              <h2 id="filtros-heading">Explore os conteúdos</h2>
              <p>Combine os filtros e aplique a seleção para atualizar os resultados.</p>
            </div>
            <div className="editorial-filter-grid">
              <TaxonomyFilter
                name="area"
                label="Área de atuação"
                value={query.area}
                options={filters.areas}
              />
              <TaxonomyFilter
                name="categoria"
                label="Categoria"
                value={query.category}
                options={filters.categories}
              />
              <TaxonomyFilter
                name="autor"
                label="Autor"
                value={query.professional}
                options={filters.authors}
              />
              <TaxonomyFilter name="tag" label="Tag" value={query.tag} options={filters.tags} />
              <FormField id="filtro-tipo" label="Tipo de conteúdo">
                {(props) => (
                  <Select {...props} name="tipo" defaultValue={query.type ?? ''}>
                    <option value="">Todos</option>
                    <option value="ARTICLE">Artigos</option>
                    <option value="UPDATE">Atualizações</option>
                    <option value="GUIDE">Guias</option>
                  </Select>
                )}
              </FormField>
              <FormField id="filtro-ano" label="Ano de publicação">
                {(props) => (
                  <Select {...props} name="ano" defaultValue={query.year?.toString() ?? ''}>
                    <option value="">Todos</option>
                    {yearAbsent ? (
                      <option value={query.year}>{query.year} (sem publicações atuais)</option>
                    ) : null}
                    {filters.years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField id="filtro-ordem" label="Ordenar por">
                {(props) => (
                  <Select {...props} name="ordem" defaultValue={query.sort}>
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="title">Título</option>
                  </Select>
                )}
              </FormField>
            </div>
            <div className="editorial-filter-actions">
              <Button type="submit">
                Aplicar filtros <span aria-hidden="true">→</span>
              </Button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Fetch the current publication state on a new document request. */}
              <a href="/conteudos" className="editorial-text-link">
                Limpar filtros
              </a>
            </div>
          </form>
          <div className="editorial-results" aria-labelledby="resultados-heading">
            <div className="editorial-result-heading">
              <h2 id="resultados-heading">Publicações</h2>
              <p className="institution-result-count">
                {pagination.total}{' '}
                {pagination.total === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}
                {pagination.pages > 0 && pagination.page <= pagination.pages
                  ? ` · Página ${pagination.page} de ${pagination.pages}`
                  : ''}
              </p>
            </div>
            {articles.length ? (
              <div className="institution-grid">
                {articles.map((article) => (
                  <EditorialArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  pagination.total > 0
                    ? 'Esta página não possui resultados'
                    : 'Nenhum conteúdo encontrado'
                }
                description={
                  pagination.total > 0
                    ? 'Volte à primeira página para consultar as publicações desta seleção.'
                    : 'Experimente outra combinação de filtros ou consulte todas as publicações.'
                }
                action={
                  <LinkButton
                    href={pagination.total > 0 ? editorialHref(query, 1) : '/conteudos'}
                    variant="secondary"
                  >
                    {pagination.total > 0 ? 'Primeira página' : 'Ver todos os conteúdos'}
                  </LinkButton>
                }
              />
            )}
            {pagination.page <= Math.max(1, pagination.pages) ? (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                getHref={(page) => editorialHref(query, page)}
                className="institution-pagination"
              />
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
