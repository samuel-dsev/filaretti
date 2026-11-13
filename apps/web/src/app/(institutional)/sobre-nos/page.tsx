import Link from 'next/link';
import { PageSections } from '@/components/institutional/shared';
import { Breadcrumb, Hero } from '@/components/site';
import { getPage } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';

const description = 'Valorizamos a escuta, a clareza e a responsabilidade em cada atendimento.';

export async function generateMetadata() {
  const page = await getPage('sobre-nos');
  return publicMetadata({
    title: page?.seoTitle ?? 'Sobre nós',
    description: page?.seoDescription ?? description,
    path: '/sobre-nos',
  });
}

export default async function AboutPage() {
  const page = await getPage('sobre-nos');
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Sobre nós' }]} />
      </div>
      <Hero title={page?.title ?? 'Sobre nós'} description={page?.seoDescription ?? description} />
      {page ? <PageSections page={page} /> : null}
      <div className="f-container institution-office-link">
        <Link href="/o-escritorio">Conheça o escritório e veja a localização</Link>
      </div>
    </>
  );
}
