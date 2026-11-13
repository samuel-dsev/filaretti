import type { PublicArticle, PublicArticleSummary, PublicProfessional } from '@filaretti/types';

interface ComplementReaders {
  articles: (area?: string) => Promise<PublicArticleSummary[]>;
  professional: (slug: string) => Promise<PublicProfessional | null>;
}

/** Optional public reads stay independent; rejected diagnostics never become view data. */
export async function loadArticleComplements(
  article: Pick<PublicArticle, 'id' | 'type' | 'practiceAreas' | 'author'>,
  readers: ComplementReaders,
) {
  const [related, author] = await Promise.allSettled([
    readers.articles(article.type === 'ARTICLE' ? undefined : article.practiceAreas[0]?.slug),
    article.author ? readers.professional(article.author.slug) : Promise.resolve(null),
  ]);
  const otherArticles =
    related.status === 'fulfilled'
      ? related.value.filter((candidate) => candidate.id !== article.id)
      : [];
  return {
    related: article.type === 'ARTICLE' ? otherArticles : otherArticles.slice(0, 3),
    author: author.status === 'fulfilled' ? author.value : null,
    relatedUnavailable: related.status === 'rejected',
  };
}
