import { notFound } from 'next/navigation';
import { AreaDetailView } from '../../../../components/institutional';
import { getArticles, getPracticeArea } from '../../../../lib/public-api';
import { publicMetadata } from '../../../../lib/public-metadata';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const area = await getPracticeArea((await params).slug);
  if (!area) notFound();
  return publicMetadata({
    title: area.name,
    description: area.summary,
    path: `/areas-de-atuacao/${area.slug}`,
  });
}

export default async function AreaPage({ params }: Props) {
  const area = await getPracticeArea((await params).slug);
  if (!area) notFound();
  const articles = await getArticles({ area: area.slug, limit: 6 });
  return <AreaDetailView area={area} articles={articles.data} />;
}
