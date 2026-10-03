import type { ReactNode } from 'react';
import { PublicLayout } from '../../components/site';
import { getPracticeAreas, getSettings } from '../../lib/public-api';

export const dynamic = 'force-dynamic';

export default async function InstitutionalLayout({ children }: { children: ReactNode }) {
  const [settings, areas] = await Promise.all([getSettings(), getPracticeAreas({ limit: 50 })]);
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
          { id: 'contents', label: 'Conteúdos', href: '/#conteudos' },
          { id: 'contact', label: 'Contato', href: '/#contato' },
        ],
      }}
      footer={{
        brand,
        description:
          'Conheça as áreas de atuação, os profissionais e as informações do escritório.',
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
              { label: 'Conteúdos publicados', href: '/#conteudos' },
              { label: 'Contato', href: '/#contato' },
              { label: 'Newsletter', href: '/#newsletter' },
            ],
          },
        ],
        ...(process.env.APP_ENV !== 'production'
          ? {
              note: 'Ambiente de desenvolvimento. Conteúdos e identidades explicitamente fictícios.',
            }
          : {}),
        copyright: `© ${new Date().getFullYear()} ${settings.siteName}`,
      }}
    >
      {children}
    </PublicLayout>
  );
}
