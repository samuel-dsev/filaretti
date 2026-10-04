import { notFound } from 'next/navigation';
import { HomeView } from '../../components/institutional';
import {
  getArticles,
  getPage,
  getPracticeAreas,
  getProfessionals,
  getSettings,
} from '../../lib/public-api';
import { contentText } from '../../lib/public-content-core';
import { publicMetadata } from '../../lib/public-metadata';
import { JsonLd, legalServiceSchema } from '@/components/seo/structured-data';

export async function generateMetadata() {
  const page = await getPage('home');
  if (!page) notFound();
  return publicMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || contentText(page.sections[0]?.body),
    path: '/',
  });
}

export default async function HomePage() {
  const [page, office, settings, areas, professionals, articles, featured, guides] =
    await Promise.all([
      getPage('home'),
      getPage('o-escritorio'),
      getSettings(),
      getPracticeAreas({ limit: 50 }),
      getProfessionals({ limit: 6 }),
      getArticles({ limit: 3 }),
      getArticles({ featured: true, limit: 3 }),
      getArticles({ type: 'GUIDE', limit: 3 }),
    ]);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={legalServiceSchema(settings)} />
      <HomeView
        page={page}
        office={office}
        settings={settings}
        areas={areas.data}
        professionals={professionals.data}
        articles={articles.data}
        featuredArticles={featured.data}
        guides={guides.data}
      />
    </>
  );
}
