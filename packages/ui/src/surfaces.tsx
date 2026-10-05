import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';

export type BadgeProps = ComponentPropsWithRef<'span'> & {
  variant?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
};

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={['f-badge', `f-badge--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}

export type CardProps = ComponentPropsWithRef<'article'> & {
  surface?: 'default' | 'soft' | 'dark';
};

export function Card({ surface = 'default', className, children, ...props }: CardProps) {
  return (
    <article
      {...props}
      className={['f-card', `f-card--${surface}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </article>
  );
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  getHref: (page: number) => string;
  label?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  getHref,
  label = 'Paginação',
  className,
}: PaginationProps) {
  const pages = Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0;
  const requestedPage = Number.isFinite(currentPage) ? Math.floor(currentPage) : 1;
  const current = Math.min(Math.max(1, requestedPage), Math.max(1, pages));
  if (pages <= 1) return null;

  const visiblePages = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter((page) => page >= 1 && page <= pages)
    .sort((left, right) => left - right);

  return (
    <nav className={['f-pagination', className].filter(Boolean).join(' ')} aria-label={label}>
      <ul className="f-pagination__list">
        {current > 1 ? (
          <li>
            <a className="f-pagination__link" href={getHref(current - 1)} rel="prev">
              <span aria-hidden="true">←</span> <span>Anterior</span>
            </a>
          </li>
        ) : null}
        {visiblePages.map((page, index) => {
          const previous = visiblePages[index - 1];
          return (
            <li className="f-pagination__item" key={page}>
              {previous !== undefined && page - previous > 1 ? (
                <span className="f-pagination__ellipsis" aria-hidden="true">
                  …
                </span>
              ) : null}
              <a
                className="f-pagination__link"
                href={getHref(page)}
                aria-label={`Página ${page}`}
                aria-current={page === current ? 'page' : undefined}
              >
                {page}
              </a>
            </li>
          );
        })}
        {current < pages ? (
          <li>
            <a className="f-pagination__link" href={getHref(current + 1)} rel="next">
              <span>Próxima</span> <span aria-hidden="true">→</span>
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export interface SkeletonProps {
  label?: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

export function Skeleton({
  label = 'Carregando conteúdo',
  width = '100%',
  height = '1.5rem',
  className,
}: SkeletonProps) {
  return (
    <span className={['f-skeleton', className].filter(Boolean).join(' ')} role="status">
      <span className="f-sr-only">{label}</span>
      <span className="f-skeleton__shape" aria-hidden="true" style={{ width, height }} />
    </span>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function EmptyState({
  title,
  description,
  action,
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <div className={['f-empty-state', className].filter(Boolean).join(' ')}>
      <span className="f-empty-state__symbol" aria-hidden="true">
        ◇
      </span>
      <Heading className="f-state__title">{title}</Heading>
      {description ? <p className="f-state__description">{description}</p> : null}
      {action ? <div className="f-state__action">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = EmptyStateProps;

export function ErrorState({
  title,
  description,
  action,
  className,
  headingLevel = 3,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <div className={['f-error-state', className].filter(Boolean).join(' ')} role="alert">
      <span className="f-error-state__symbol" aria-hidden="true">
        !
      </span>
      <Heading className="f-state__title">{title}</Heading>
      {description ? <p className="f-state__description">{description}</p> : null}
      {action ? <div className="f-state__action">{action}</div> : null}
    </div>
  );
}
