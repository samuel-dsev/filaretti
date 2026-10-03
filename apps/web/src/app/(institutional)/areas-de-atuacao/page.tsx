import { AreaIndexView } from '../../../components/institutional';
import { getPracticeAreas } from '../../../lib/public-api';
import { publicMetadata } from '../../../lib/public-metadata';
import { publicPageNumber } from '../../../lib/public-routing';

export const metadata = publicMetadata({
  title: 'Áreas de atuação',
  description: 'Conheça as áreas de atuação e suas relações com os profissionais do escritório.',
  path: '/areas-de-atuacao',
});

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const page = publicPageNumber((await searchParams).pagina);
  const areas = await getPracticeAreas({ page, limit: 12 });
  return <AreaIndexView areas={areas.data} pagination={areas.meta} />;
}
