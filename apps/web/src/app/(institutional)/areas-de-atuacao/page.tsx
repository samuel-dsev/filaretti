import { AreaIndexView } from '../../../components/institutional';
import { getPracticeAreas } from '../../../lib/public-api';
import { publicMetadata } from '../../../lib/public-metadata';
import { publicPageNumber } from '../../../lib/public-routing';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return publicMetadata({
    title: 'Áreas de atuação',
    description: 'Conheça as áreas de atuação e suas relações com os profissionais do escritório.',
    path: '/areas-de-atuacao',
    noIndex: Object.keys(await searchParams).length > 0,
  });
}

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const page = publicPageNumber((await searchParams).pagina);
  const areas = await getPracticeAreas({ page, limit: 12 });
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Início', path: '/' },
          { name: 'Áreas de atuação', path: '/areas-de-atuacao' },
        ])}
      />
      <AreaIndexView areas={areas.data} pagination={areas.meta} />
    </>
  );
}
