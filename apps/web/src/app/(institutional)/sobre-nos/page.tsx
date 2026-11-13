import Link from 'next/link';
import { AreaGrid, InstitutionalSection, PageSections } from '@/components/institutional/shared';
import { Breadcrumb, Hero } from '@/components/site';
import { getPage, getPracticeAreas } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';

const description =
  'A Filaretti valoriza a escuta, a clareza e a responsabilidade em cada atendimento.';

export async function generateMetadata() {
  const page = await getPage('sobre-nos');
  return publicMetadata({
    title: page?.seoTitle ?? 'Sobre nós',
    description: page?.seoDescription ?? description,
    path: '/sobre-nos',
  });
}

export default async function AboutPage() {
  const [page, areas] = await Promise.all([getPage('sobre-nos'), getPracticeAreas({ limit: 50 })]);
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Sobre nós' }]} />
      </div>
      <Hero title={page?.title ?? 'Sobre nós'} description={page?.seoDescription ?? description} />
      {page ? <PageSections page={page} /> : null}
      <InstitutionalSection
        id="areas-de-atuacao"
        title="Áreas de atuação"
        action={{ label: 'Todas as áreas', href: '/areas-de-atuacao' }}
        soft
      >
        <AreaGrid areas={areas.data} />
      </InstitutionalSection>
      <div className="f-container institution-office-link">
        <Link href="/o-escritorio">Conheça o escritório e veja a localização</Link>
      </div>
    </>
  );
}
