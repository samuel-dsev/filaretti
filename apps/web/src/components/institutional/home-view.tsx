import { ArticleCarousel } from '@/components/editorial/article-carousel';
import { PhotoHero } from './photo-hero';
import { AreaGrid, InstitutionalSection } from './shared';
import type { HomeViewProps } from './types';

export function HomeView({ page, areas, articles }: HomeViewProps) {
  return (
    <>
      <PhotoHero
        headingId="home-heading"
        title={page.title}
        description={page.seoDescription ?? undefined}
        fillViewport
      />
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
