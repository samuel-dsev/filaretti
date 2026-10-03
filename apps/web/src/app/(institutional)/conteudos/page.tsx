import { EditorialIndexView } from '@/components/editorial/index-view';
import { getArticles, getEditorialFilters } from '@/lib/public-api';
import { parseEditorialQuery } from '@/lib/editorial-query';
import { publicMetadata } from '@/lib/public-metadata';

export const metadata = publicMetadata({
  title: 'Conteúdos',
  description:
    'Explore artigos, atualizações e guias por área de atuação, categoria, autor e assunto.',
  path: '/conteudos',
});

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
    <EditorialIndexView
      articles={articles.data}
      pagination={articles.meta}
      filters={filters}
      query={query}
    />
  );
}
