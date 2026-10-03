import { ProfessionalIndexView } from '../../../components/institutional';
import { getProfessionals } from '../../../lib/public-api';
import { publicMetadata } from '../../../lib/public-metadata';
import { publicPageNumber } from '../../../lib/public-routing';

export const metadata = publicMetadata({
  title: 'Profissionais',
  description:
    'Conheça os perfis, trajetórias e áreas de atuação dos profissionais apresentados pelo escritório.',
  path: '/profissionais',
});

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const professionals = await getProfessionals({
    page: publicPageNumber((await searchParams).pagina),
    limit: 12,
  });
  return (
    <ProfessionalIndexView professionals={professionals.data} pagination={professionals.meta} />
  );
}
