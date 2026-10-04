import { notFound } from 'next/navigation';
import { EditorialDetailView } from '@/components/editorial/detail-view';
import { getArticle, getArticles, getProfessional } from '@/lib/public-api';
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
  const [related, author] = await Promise.all([
    getArticles({ area: article.practiceAreas[0]?.slug, limit: 4 }),
    article.author ? getProfessional(article.author.slug) : Promise.resolve(null),
  ]);
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
        author={author}
        related={related.data.filter((candidate) => candidate.id !== article.id).slice(0, 3)}
        shareUrl={typeof canonical === 'string' ? canonical : undefined}
      />
    </>
  );
}
