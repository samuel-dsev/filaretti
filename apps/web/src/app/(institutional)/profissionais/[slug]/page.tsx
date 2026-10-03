import { notFound } from 'next/navigation';
import { ProfessionalDetailView } from '../../../../components/institutional';
import { getArticles, getProfessional } from '../../../../lib/public-api';
import { contentText } from '../../../../lib/public-content-core';
import { publicMetadata } from '../../../../lib/public-metadata';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const professional = await getProfessional((await params).slug);
  if (!professional) notFound();
  return publicMetadata({
    title: professional.name,
    description: contentText(professional.bio),
    path: `/profissionais/${professional.slug}`,
  });
}

export default async function ProfessionalPage({ params }: Props) {
  const professional = await getProfessional((await params).slug);
  if (!professional) notFound();
  const articles = await getArticles({ professional: professional.slug, limit: 6 });
  return <ProfessionalDetailView professional={professional} articles={articles.data} />;
}
