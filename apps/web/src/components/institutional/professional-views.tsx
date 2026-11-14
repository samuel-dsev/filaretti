import Image from 'next/image';
import { Pagination } from '@filaretti/ui';
import { Breadcrumb } from '@/components/site';
import { PublicContent } from '@/lib/public-content';
import { isManagedPublicMedia, publicImage } from '@/lib/public-media';
import {
  AreaRelationLinks,
  ArticlePreviewGrid,
  InstitutionalSection,
  ProfessionalGrid,
} from './shared';
import type { ProfessionalDetailViewProps, ProfessionalIndexViewProps } from './types';

export function ProfessionalIndexView({ professionals, pagination }: ProfessionalIndexViewProps) {
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Equipe' }]} />
      </div>
      <div className="f-container institution-index-content institution-professional-index">
        <h1 className="site-catalog-heading">Nossos Profissionais</h1>
        <h2 className="f-sr-only">Perfis publicados</h2>
        <ProfessionalGrid professionals={professionals} />
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

export function ProfessionalDetailView({ professional, articles }: ProfessionalDetailViewProps) {
  const image = publicImage(professional.photo, professional.name);
  const { education, experience } = professional;

  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Equipe', href: '/profissionais' },
            { label: professional.name },
          ]}
        />
      </div>
      <div
        className={`f-container institution-profile${image ? ' institution-profile-with-photo' : ''}`}
      >
        <div className="institution-profile-copy">
          <header>
            {professional.title ? <p className="site-eyebrow">{professional.title}</p> : null}
            <h1>{professional.name}</h1>
          </header>
          <section id="biografia" aria-labelledby="biografia-heading">
            <h2 id="biografia-heading" className="site-catalog-heading">
              Trajetória profissional
            </h2>
            <div className="institution-readable">
              <PublicContent document={professional.bio} />
            </div>
          </section>
        </div>
        {image ? (
          <div className="institution-profile-photo">
            <Image
              src={image.src}
              unoptimized={isManagedPublicMedia(image.src)}
              alt={image.alt}
              width={720}
              height={800}
              sizes="(max-width: 767px) calc(100vw - 32px), 38vw"
            />
          </div>
        ) : null}
      </div>
      {education.length || experience.length ? (
        <section className="institution-section institution-section-soft">
          <div className="f-container institution-profile-background">
            {education.length ? (
              <div>
                <h2>Formação</h2>
                <ul className="institution-background-list">
                  {education.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {experience.length ? (
              <div>
                <h2>Experiência</h2>
                <ul className="institution-background-list">
                  {experience.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {professional.practiceAreas.length ? (
        <InstitutionalSection id="areas" title="Áreas de atuação">
          <AreaRelationLinks areas={professional.practiceAreas} />
        </InstitutionalSection>
      ) : null}
      {articles.length ? (
        <InstitutionalSection id="publicacoes" title="Publicações" soft>
          <ArticlePreviewGrid articles={articles} emptyTitle="Nenhuma publicação vinculada" />
        </InstitutionalSection>
      ) : null}
    </>
  );
}
