import { notFound } from 'next/navigation';
import { HomeView } from '../../components/institutional';
import { getPage, getPracticeAreas, getPublishedArticles, getSettings } from '../../lib/public-api';
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
  const [page, settings, areas, articles] = await Promise.all([
    getPage('home'),
    getSettings(),
    getPracticeAreas({ limit: 50 }),
    getPublishedArticles(),
  ]);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={legalServiceSchema(settings)} />
      <HomeView page={page} areas={areas.data} articles={articles} />
    </>
  );
}
