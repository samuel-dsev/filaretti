import { EmptyState, Pagination } from '@filaretti/ui';
import { Breadcrumb, Hero } from '@/components/site';
import { PublicContent } from '@/lib/public-content';
import { PhotoHero } from './photo-hero';
import { AreaGrid, InstitutionalSection } from './shared';
import type { AreaDetailViewProps, AreaIndexViewProps } from './types';

export function AreaIndexView({ areas, pagination }: AreaIndexViewProps) {
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Áreas de atuação' }]} />
      </div>
      <PhotoHero
        headingId="areas-heading"
        title="Áreas de atuação"
        imageSrc="/brand/areas-de-atuacao.webp"
        description="Uma decisão bem orientada começa pela compreensão do que está em jogo. Nós analisamos cada situação com atenção aos detalhes e explicamos os caminhos possíveis, da prevenção de conflitos à defesa dos seus direitos."
      />
      <div className="f-container institution-index-content">
        <h2 className="f-sr-only">Áreas publicadas</h2>
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

export function AreaDetailView({ area }: AreaDetailViewProps) {
  return (
    <div className="institution-area-detail">
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Áreas de atuação', href: '/areas-de-atuacao' },
            { label: area.name },
          ]}
        />
      </div>
      <div className="f-container institution-area-columns">
        <div>
          <Hero eyebrow="Área de atuação" title={area.name} description={area.summary} />
          <InstitutionalSection id="apresentacao" title="Apresentação" eyebrow="Sobre a área">
            <div className="institution-readable">
              <PublicContent document={area.description} />
            </div>
          </InstitutionalSection>
        </div>
        <InstitutionalSection id="servicos" title="Serviços" eyebrow="Atuação">
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
      </div>
    </div>
  );
}
