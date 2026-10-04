import { notFound } from 'next/navigation';
import { Breadcrumb, Hero } from '@/components/site';
import { PageSections } from '@/components/institutional/shared';
import { CookiePreferencesButton } from '@/components/privacy/consent-provider';
import { getPage } from '@/lib/public-api';
import { contentText } from '@/lib/public-content-core';
import { publicMetadata } from '@/lib/public-metadata';

export async function generateMetadata() {
  const page = await getPage('cookies');
  if (!page) notFound();
  return publicMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || contentText(page.sections[0]?.body),
    path: '/cookies',
  });
}
export default async function CookiesPage() {
  const page = await getPage('cookies');
  if (!page) notFound();
  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Cookies' }]} />
      <Hero eyebrow="Informações" title={page.title} />
      <div className="f-container">
        {process.env.APP_ENV !== 'production' ? (
          <p className="relationship-note">
            Conteúdo fictício de desenvolvimento. O texto oficial depende de aprovação do
            escritório.
          </p>
        ) : null}
        <CookiePreferencesButton />
      </div>
      <PageSections page={page} />
    </>
  );
}
