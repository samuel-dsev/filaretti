import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { PublicArticle } from '@filaretti/types';
import { Skeleton } from '@filaretti/ui';
import { EditorialComplementsView, EditorialDetailView } from '@/components/editorial/detail-view';
import { getArticle, getArticles, getProfessional } from '@/lib/public-api';
import { loadArticleComplements } from '@/lib/article-complements';
import { publicMetadata } from '@/lib/public-metadata';
import { JsonLd, articleSchema, breadcrumbSchema } from '@/components/seo/structured-data';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  return publicMetadata({
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.excerpt,
    path: `/conteudos/${encodeURIComponent(article.slug)}`,
    image: article.cover,
    article: { publishedAt: article.publishedAt, updatedAt: article.updatedAt },
  });
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  const metadata = publicMetadata({
    title: article.title,
    path: `/conteudos/${encodeURIComponent(article.slug)}`,
  });
  const canonical = metadata.alternates?.canonical;
  return (
    <>
      <JsonLd
        data={[
          articleSchema(article),
          breadcrumbSchema([
            { name: 'Início', path: '/' },
            { name: 'Conteúdos', path: '/conteudos' },
            { name: article.title, path: `/conteudos/${article.slug}` },
          ]),
        ]}
      />
      <EditorialDetailView
        article={article}
        author={null}
        related={[]}
        includeComplements={false}
        shareUrl={typeof canonical === 'string' ? canonical : undefined}
      />
      <Suspense
        fallback={
          <div className="editorial-complements-loading">
            <div className="f-container">
              <Skeleton label="Carregando informações complementares da publicação" />
            </div>
          </div>
        }
      >
        <ArticleComplements article={article} />
      </Suspense>
    </>
  );
}

async function ArticleComplements({ article }: { article: PublicArticle }) {
  // Optional below-the-fold reads do not hold the title and article body in the route fallback.
  // Both remain bounded/no-store and fail independently without hiding the publication.
  const complements = await loadArticleComplements(article, {
    articles: async (area) => (await getArticles({ area, limit: 4 })).data,
    professional: getProfessional,
  });
  return (
    <EditorialComplementsView
      article={article}
      author={complements.author}
      related={complements.related}
      relatedUnavailable={complements.relatedUnavailable}
    />
  );
}
