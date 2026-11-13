import type { PublicArticleSummary } from '@filaretti/types';
import { EmptyState } from '@filaretti/ui';
import { EditorialArticleCard } from './article-card';
import { ArticleCarouselTrack } from './article-carousel-track';

export function ArticleCarousel({
  articles,
  label,
}: {
  articles: PublicArticleSummary[];
  label: string;
}) {
  if (articles.length === 0) {
    return <EmptyState title="Nenhum artigo publicado" />;
  }

  return (
    <ArticleCarouselTrack label={label}>
      {articles.map((article) => (
        <li key={article.id}>
          <EditorialArticleCard article={article} />
        </li>
      ))}
    </ArticleCarouselTrack>
  );
}
