import { EditorialIndexView } from '@/components/editorial/index-view';
import { getArticles, getEditorialFilters } from '@/lib/public-api';
import { parseEditorialQuery } from '@/lib/editorial-query';
import { publicMetadata } from '@/lib/public-metadata';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return publicMetadata({
    title: 'Conteúdos',
    description:
      'Explore artigos, atualizações e guias por área de atuação, categoria, autor e assunto.',
    path: '/conteudos',
    noIndex: Object.keys(await searchParams).length > 0,
  });
}

export default async function EditorialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseEditorialQuery(await searchParams);
  const [articles, filters] = await Promise.all([
    getArticles({ ...query, limit: 12 }),
    getEditorialFilters(),
  ]);
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Início', path: '/' },
          { name: 'Conteúdos', path: '/conteudos' },
        ])}
      />
      <EditorialIndexView
        articles={articles.data}
        pagination={articles.meta}
        filters={filters}
        query={query}
      />
    </>
  );
}
