import { notFound } from 'next/navigation';
import { AreaDetailView } from '../../../../components/institutional';
import { getArticles, getFaqs, getPracticeArea } from '../../../../lib/public-api';
import { JsonLd, faqSchema, breadcrumbSchema } from '@/components/seo/structured-data';
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
  const [articles, faqs] = await Promise.all([
    getArticles({ area: area.slug, limit: 6 }),
    getFaqs({ area: area.slug, limit: 12 }),
  ]);
  return (
    <>
      <JsonLd
        data={[
          faqSchema(faqs.data),
          breadcrumbSchema([
            { name: 'Início', path: '/' },
            { name: 'Áreas de atuação', path: '/areas-de-atuacao' },
            { name: area.name, path: `/areas-de-atuacao/${area.slug}` },
          ]),
        ]}
      />
      <AreaDetailView
        area={area}
        articles={articles.data}
        faqs={faqs.data}
        faqTotal={faqs.meta.total}
      />
    </>
  );
}
