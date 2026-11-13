import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { PublicLayout } from '../../components/site';
import { getArticle, getSettings } from '../../lib/public-api';
import { officeAddress } from '@/lib/office-address';
import { safePublicUrl } from '@/lib/public-content-core';
import { ContactForm } from '@/components/relationship/contact-form';
import { relationshipConfiguration } from '@/components/relationship/configuration';
import { validateWebEnvironment } from '@filaretti/config';

export const dynamic = 'force-dynamic';

export default async function InstitutionalLayout({ children }: { children: ReactNode }) {
  const articleSlug = (await headers()).get('x-filaretti-article-slug');
  // React cache deduplicates this no-store read with metadata/page for this render.
  // Start primary publication data alongside navigation instead of after the layout.
  const [settings] = await Promise.all([
    getSettings(),
    articleSlug && articleSlug.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(articleSlug)
      ? getArticle(articleSlug)
      : Promise.resolve(null),
  ]);
  const brand = { name: settings.siteName, href: '/', monogram: 'F' };
  const email = settings.publicEmail ? safePublicUrl(`mailto:${settings.publicEmail}`) : null;
  const caseIntakeEnabled = validateWebEnvironment(process.env).caseIntakeEnabled;
  return (
    <PublicLayout
      header={{
        brand,
        navigation: [
          {
            id: 'about',
            label: 'Quem somos',
            href: '/sobre-nos',
            dropdown: true,
            children: [
              { label: 'Sobre nós', href: '/sobre-nos' },
              { label: 'O escritório', href: '/o-escritorio' },
            ],
          },
          { id: 'areas', label: 'Áreas de atuação', href: '/areas-de-atuacao' },
          { id: 'professionals', label: 'Equipe', href: '/profissionais' },
          { id: 'contents', label: 'Conteúdos', href: '/conteudos' },
          { id: 'contact', label: 'Contato', href: '/contato' },
        ],
      }}
      footer={{
        brand,
        description:
          'Atuação integrada, escuta próxima e conhecimento jurídico para apoiar suas decisões.',
        address: officeAddress(settings.address),
        email:
          email && settings.publicEmail
            ? { address: settings.publicEmail, href: email }
            : undefined,
        homeForm: caseIntakeEnabled ? (
          <ContactForm config={relationshipConfiguration()} caseIntake />
        ) : undefined,
        groups: [
          {
            title: 'Institucional',
            links: [
              { label: 'Sobre nós', href: '/sobre-nos' },
              { label: 'O escritório', href: '/o-escritorio' },
              { label: 'Áreas de atuação', href: '/areas-de-atuacao' },
              { label: 'Equipe', href: '/profissionais' },
            ],
          },
          {
            title: 'Informações',
            links: [
              { label: 'Conteúdos publicados', href: '/conteudos' },
              { label: 'Contato', href: '/contato' },
              ...(caseIntakeEnabled ? [{ label: 'Conte seu caso', href: '/#conte-seu-caso' }] : []),
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
      whatsapp={safePublicUrl(settings.whatsappUrl)}
    >
      {children}
    </PublicLayout>
  );
}
