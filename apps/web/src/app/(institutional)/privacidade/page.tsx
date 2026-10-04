import { notFound } from 'next/navigation';
import { Breadcrumb, Hero } from '@/components/site';
import { PageSections } from '@/components/institutional/shared';
import { getPage } from '@/lib/public-api';
import { contentText } from '@/lib/public-content-core';
import { publicMetadata } from '@/lib/public-metadata';

export async function generateMetadata() {
  const page = await getPage('privacidade');
  if (!page) notFound();
  return publicMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || contentText(page.sections[0]?.body),
    path: '/privacidade',
  });
}
export default async function PrivacyPage() {
  const page = await getPage('privacidade');
  if (!page) notFound();
  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Privacidade' }]} />
      <Hero eyebrow="Informações" title={page.title} />
      {process.env.APP_ENV !== 'production' ? (
        <p className="f-container relationship-note">
          Conteúdo fictício de desenvolvimento. O aviso oficial e os prazos de retenção dependem de
          aprovação do escritório.
        </p>
      ) : null}
      <PageSections page={page} />
    </>
  );
}
