import { ProfessionalIndexView } from '../../../components/institutional';
import { getProfessionals } from '../../../lib/public-api';
import { publicMetadata } from '../../../lib/public-metadata';
import { publicPageNumber } from '../../../lib/public-routing';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return publicMetadata({
    title: 'Profissionais',
    description:
      'Conheça os perfis, trajetórias e áreas de atuação dos profissionais apresentados pelo escritório.',
    path: '/profissionais',
    noIndex: Object.keys(await searchParams).length > 0,
  });
}

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
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Início', path: '/' },
          { name: 'Profissionais', path: '/profissionais' },
        ])}
      />
      <ProfessionalIndexView professionals={professionals.data} pagination={professionals.meta} />
    </>
  );
}
