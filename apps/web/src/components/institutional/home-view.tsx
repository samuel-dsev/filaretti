import { ArticleCarousel } from '@/components/editorial/article-carousel';
import { contentText } from '@/lib/public-content-core';
import { publicImage } from '@/lib/public-media';
import { PhotoHero } from './photo-hero';
import { AreaGrid, InstitutionalSection } from './shared';
import { TeamCarousel } from './team-carousel';
import type { HomeViewProps } from './types';

export function HomeView({ page, areas, professionals, articles }: HomeViewProps) {
  const members = professionals.map((professional) => ({
    id: professional.id,
    name: professional.name,
    title: professional.title,
    qualification: contentText(professional.bio, 200) || professional.education[0],
    href: `/profissionais/${encodeURIComponent(professional.slug)}`,
    image: publicImage(professional.photo, professional.name),
  }));

  return (
    <>
      <PhotoHero
        headingId="home-heading"
        title={page.title}
        description={page.seoDescription ?? undefined}
      />
      <TeamCarousel members={members} />
      <InstitutionalSection
        id="conteudos"
        title="Artigos"
        action={{ label: 'Todos os artigos', href: '/conteudos?tipo=ARTICLE' }}
      >
        <ArticleCarousel articles={articles} label="Artigos publicados" />
      </InstitutionalSection>
      <InstitutionalSection
        id="areas"
        title="Áreas de atuação"
        eyebrow="Atuação"
        action={{ label: 'Todas as áreas', href: '/areas-de-atuacao' }}
      >
        <AreaGrid
          areas={areas.filter((area) => area.slug !== 'consultoria-empresarial').slice(0, 6)}
        />
      </InstitutionalSection>
    </>
  );
}
