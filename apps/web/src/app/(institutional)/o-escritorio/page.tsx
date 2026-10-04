import { notFound } from 'next/navigation';
import { OfficeView } from '../../../components/institutional';
import { getPage, getProfessionals, getSettings } from '../../../lib/public-api';
import { contentText } from '../../../lib/public-content-core';
import { publicMetadata } from '../../../lib/public-metadata';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';

export async function generateMetadata() {
  const page = await getPage('o-escritorio');
  if (!page) notFound();
  return publicMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || contentText(page.sections[0]?.body),
    path: '/o-escritorio',
  });
}

export default async function OfficePage() {
  const [page, settings, professionals] = await Promise.all([
    getPage('o-escritorio'),
    getSettings(),
    getProfessionals({ limit: 6 }),
  ]);
  if (!page) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Início', path: '/' },
          { name: page.title, path: '/o-escritorio' },
        ])}
      />
      <OfficeView page={page} settings={settings} professionals={professionals.data} />
    </>
  );
}
