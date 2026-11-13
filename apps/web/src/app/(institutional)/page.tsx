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
  const [page, settings, areas, professionals, articles] = await Promise.all([
    getPage('home'),
    getSettings(),
    getPracticeAreas({ limit: 50 }),
    getHomeProfessionals(),
    getArticles({ type: 'ARTICLE', limit: 3 }),
  ]);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={legalServiceSchema(settings)} />
      <HomeView
        page={page}
        areas={areas.data}
        professionals={professionals}
        articles={articles.data}
      />
    </>
  );
}

async function getHomeProfessionals() {
  const first = await getProfessionals({ limit: 50 });
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, first.meta.pages - 1) }, (_, index) =>
      getProfessionals({ page: index + 2, limit: 50 }),
    ),
  );
  return first.data.concat(...remaining.map(({ data }) => data));
}
