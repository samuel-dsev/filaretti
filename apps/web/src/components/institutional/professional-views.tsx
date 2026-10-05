import Image from 'next/image';
import { EmptyState, Pagination } from '@filaretti/ui';
import { Breadcrumb, Hero } from '@/components/site';
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
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Profissionais' }]} />
      </div>
      <Hero eyebrow="Equipe" title="Profissionais" />
      <div className="f-container institution-index-content">
        <h2 className="f-sr-only">Perfis publicados</h2>
        <p className="institution-result-count">
          {pagination.total} {pagination.total === 1 ? 'perfil publicado' : 'perfis publicados'}
        </p>
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
  const initials = professional.name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('');

  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Profissionais', href: '/profissionais' },
            { label: professional.name },
          ]}
        />
      </div>
      <Hero
        eyebrow={professional.title}
        title={professional.name}
        visual={
          image ? (
            <div className="institution-profile-photo">
              <Image
                src={image.src}
                unoptimized={isManagedPublicMedia(image.src)}
                alt={image.alt}
                width={720}
                height={800}
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) 40vw, 45vw"
              />
            </div>
          ) : (
            <div className="institution-profile-placeholder">
              <span aria-hidden="true">{initials}</span>
              <p>Retrato em preparação</p>
            </div>
          )
        }
      />
      <InstitutionalSection id="biografia" title="Biografia" eyebrow="Perfil">
        <div className="institution-readable">
          <PublicContent document={professional.bio} />
        </div>
      </InstitutionalSection>
      <section className="institution-section institution-section-soft">
        <div className="f-container institution-profile-background">
          <div>
            <h2>Formação</h2>
            {professional.education.length ? (
              <ul className="institution-background-list">
                {professional.education.map((education, index) => (
                  <li key={`${education}-${index}`}>{education}</li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Formação não publicada" />
            )}
          </div>
          <div>
            <h2>Experiência</h2>
            {professional.experience.length ? (
              <ul className="institution-background-list">
                {professional.experience.map((experience, index) => (
                  <li key={`${experience}-${index}`}>{experience}</li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Experiência não publicada" />
            )}
          </div>
        </div>
      </section>
      <InstitutionalSection id="areas" title="Áreas de atuação" eyebrow="Atuação">
        <AreaRelationLinks areas={professional.practiceAreas} />
      </InstitutionalSection>
      <InstitutionalSection id="publicacoes" title="Publicações" eyebrow="Conteúdos" soft>
        <ArticlePreviewGrid articles={articles} emptyTitle="Nenhuma publicação vinculada" />
      </InstitutionalSection>
    </>
  );
}
