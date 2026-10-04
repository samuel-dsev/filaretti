import { EmptyState, Pagination } from '@filaretti/ui';
import Link from 'next/link';
import { FaqList } from '@/components/search/faq-list';
import { Breadcrumb, Hero } from '@/components/site';
import { PublicContent } from '@/lib/public-content';
import { ArticlePreviewGrid, AreaGrid, InstitutionalSection, ProfessionalGrid } from './shared';
import type { AreaDetailViewProps, AreaIndexViewProps } from './types';

export function AreaIndexView({ areas, pagination }: AreaIndexViewProps) {
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Áreas de atuação' }]} />
      </div>
      <Hero eyebrow="Atuação" title="Áreas de atuação" />
      <div className="f-container institution-index-content">
        <p className="institution-result-count">
          {pagination.total} {pagination.total === 1 ? 'área publicada' : 'áreas publicadas'}
        </p>
        <AreaGrid areas={areas} />
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          getHref={(page) => `?pagina=${page}`}
          className="institution-pagination"
        />
      </div>
    </>
  );
}

export function AreaDetailView({ area, articles, faqs = [], faqTotal = 0 }: AreaDetailViewProps) {
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Áreas de atuação', href: '/areas-de-atuacao' },
            { label: area.name },
          ]}
        />
      </div>
      <Hero eyebrow="Área de atuação" title={area.name} description={area.summary} />
      <InstitutionalSection id="apresentacao" title="Apresentação" eyebrow="Sobre a área">
        <div className="institution-readable">
          <PublicContent document={area.description} />
        </div>
      </InstitutionalSection>
      <InstitutionalSection id="servicos" title="Serviços" eyebrow="Atuação" soft>
        {area.services.length ? (
          <ul className="institution-service-list">
            {area.services.map((service, index) => (
              <li key={`${service}-${index}`}>
                <span className="institution-service-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{service}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum serviço publicado" />
        )}
      </InstitutionalSection>
      <InstitutionalSection id="profissionais" title="Profissionais" eyebrow="Equipe da área">
        <ProfessionalGrid professionals={area.professionals} />
      </InstitutionalSection>
      <InstitutionalSection
        id="conteudos-relacionados"
        title="Conteúdos relacionados"
        eyebrow="Publicações"
        soft
      >
        <ArticlePreviewGrid
          articles={articles}
          emptyTitle="Nenhum conteúdo relacionado publicado"
        />
      </InstitutionalSection>
      <InstitutionalSection
        id="perguntas-frequentes"
        title="Perguntas frequentes"
        eyebrow="Sobre esta área"
      >
        <FaqList faqs={faqs} />
        {faqTotal > faqs.length ? (
          <p>
            <Link
              href={`/perguntas-frequentes?area=${encodeURIComponent(area.slug)}`}
              prefetch={false}
            >
              Ver todas as perguntas desta área
            </Link>
          </p>
        ) : null}
      </InstitutionalSection>
    </>
  );
}
