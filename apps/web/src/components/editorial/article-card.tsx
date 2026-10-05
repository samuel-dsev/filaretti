import type { PublicArticleSummary } from '@filaretti/types';
import { EditorialCard } from '@/components/site';
import { publicImage } from '@/lib/public-media';
import styles from './article-card.module.css';

export const articleTypeLabels: Record<PublicArticleSummary['type'], string> = {
  ARTICLE: 'Artigo',
  UPDATE: 'Atualização',
  GUIDE: 'Guia',
};

export const publicationDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export function EditorialArticleCard({ article }: { article: PublicArticleSummary }) {
  return (
    <a href={`/conteudos/${encodeURIComponent(article.slug)}`} className={styles.cardLink}>
      <EditorialCard
        category={article.categories[0]?.name ?? articleTypeLabels[article.type]}
        title={article.title}
        description={article.excerpt}
        dateLabel={publicationDate.format(new Date(article.publishedAt))}
        readingTimeLabel={`${article.readingTimeMinutes} min de leitura`}
        image={publicImage(article.cover, article.title)}
        label={articleTypeLabels[article.type]}
      />
    </a>
  );
}
