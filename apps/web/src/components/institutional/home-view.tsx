import { Hero, PlaceholderArtwork } from '@/components/site';
import { PublicContent } from '@/lib/public-content';
import {
  ArticlePreviewGrid,
  AreaGrid,
  ContactChannels,
  InstitutionalSection,
  PageSections,
  ProfessionalGrid,
} from './shared';
import type { HomeViewProps } from './types';

export function HomeView({
  settings,
  page,
  office,
  areas,
  professionals,
  articles,
  guides,
  featuredArticles,
}: HomeViewProps) {
  return (
    <>
      <Hero
        eyebrow={settings.siteName}
        title={page.title}
        description={page.seoDescription ?? undefined}
        actions={[
          { label: 'Áreas de atuação', href: '/areas-de-atuacao' },
          ...(office
            ? [{ label: 'Conhecer o escritório', href: '/o-escritorio', secondary: true }]
            : []),
        ]}
        visual={<PlaceholderArtwork />}
      />
      <PageSections page={page} />
      <InstitutionalSection id="destaques" title="Destaques" eyebrow="Conteúdos" soft>
        <ArticlePreviewGrid articles={featuredArticles} emptyTitle="Nenhum destaque publicado" />
      </InstitutionalSection>
      <InstitutionalSection
        id="areas"
        title="Áreas de atuação"
        eyebrow="Atuação"
        action={{ label: 'Todas as áreas', href: '/areas-de-atuacao' }}
      >
        <AreaGrid areas={areas.slice(0, 6)} />
      </InstitutionalSection>
      {office ? (
        <InstitutionalSection
          id="escritorio"
          title={office.title}
          eyebrow="O escritório"
          action={{ label: 'Conhecer o escritório', href: '/o-escritorio' }}
          soft
        >
          <div className="institution-office-summary">
            {office.sections[0] ? (
              <PublicContent document={office.sections[0].body} />
            ) : (
              <p>Conteúdo em preparação.</p>
            )}
          </div>
        </InstitutionalSection>
      ) : null}
      <InstitutionalSection id="conteudos" title="Conteúdos recentes" eyebrow="Publicações">
        <ArticlePreviewGrid articles={articles} />
      </InstitutionalSection>
      <InstitutionalSection
        id="profissionais"
        title="Profissionais"
        eyebrow="Equipe"
        action={{ label: 'Todos os profissionais', href: '/profissionais' }}
        soft
      >
        <ProfessionalGrid professionals={professionals.slice(0, 3)} />
      </InstitutionalSection>
      <InstitutionalSection id="guias" title="Guias" eyebrow="Publicações">
        <ArticlePreviewGrid articles={guides} emptyTitle="Nenhum guia publicado" />
      </InstitutionalSection>
      <InstitutionalSection id="contato" title="Contato" eyebrow="Canais de contato" soft>
        <ContactChannels settings={settings} />
      </InstitutionalSection>
    </>
  );
}
