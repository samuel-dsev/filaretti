import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { PublicLayout } from '../../components/site';
import { getArticle, getPracticeAreas, getSettings } from '../../lib/public-api';

export const dynamic = 'force-dynamic';

export default async function InstitutionalLayout({ children }: { children: ReactNode }) {
  const articleSlug = (await headers()).get('x-filaretti-article-slug');
  // React cache deduplicates this no-store read with metadata/page for this render.
  // Start primary publication data alongside navigation instead of after the layout.
  const [settings, areas] = await Promise.all([
    getSettings(),
    getPracticeAreas({ limit: 50 }),
    articleSlug && articleSlug.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(articleSlug)
      ? getArticle(articleSlug)
      : Promise.resolve(null),
  ]);
  const brand = { name: settings.siteName, href: '/', monogram: 'F' };
  return (
    <PublicLayout
      header={{
        brand,
        navigation: [
          { id: 'office', label: 'O escritório', href: '/o-escritorio' },
          {
            id: 'areas',
            label: 'Áreas de atuação',
            href: '/areas-de-atuacao',
            children: [
              { label: 'Todas as áreas', href: '/areas-de-atuacao' },
              ...areas.data.map((area) => ({
                label: area.name,
                href: `/areas-de-atuacao/${area.slug}`,
                description: area.summary,
              })),
            ],
          },
          { id: 'professionals', label: 'Profissionais', href: '/profissionais' },
          { id: 'contents', label: 'Conteúdos', href: '/conteudos' },
          { id: 'contact', label: 'Contato', href: '/contato' },
        ],
      }}
      footer={{
        brand,
        description:
          'Atuação integrada, escuta próxima e conhecimento jurídico para apoiar suas decisões.',
        groups: [
          {
            title: 'Institucional',
            links: [
              { label: 'O escritório', href: '/o-escritorio' },
              { label: 'Áreas de atuação', href: '/areas-de-atuacao' },
              { label: 'Profissionais', href: '/profissionais' },
            ],
          },
          {
            title: 'Informações',
            links: [
              { label: 'Conteúdos publicados', href: '/conteudos' },
              { label: 'Contato', href: '/contato' },
              { label: 'Newsletter', href: '/newsletter' },
            ],
          },
        ],
        ...(process.env.APP_ENV !== 'production'
          ? {
              note: 'Conhecimento jurídico para decisões conscientes.',
            }
          : {}),
        copyright: `© ${new Date().getFullYear()} ${settings.siteName}`,
      }}
    >
      {children}
    </PublicLayout>
  );
}
