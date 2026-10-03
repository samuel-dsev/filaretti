import { Breadcrumb, Hero, PlaceholderArtwork } from '@/components/site';
import { ContactChannels, InstitutionalSection, PageSections, ProfessionalGrid } from './shared';
import type { OfficeViewProps } from './types';

export function OfficeView({ page, settings, professionals }: OfficeViewProps) {
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'O escritório' }]} />
      </div>
      <Hero
        eyebrow={settings.siteName}
        title={page.title}
        description={page.seoDescription ?? undefined}
        visual={<PlaceholderArtwork />}
      />
      <PageSections page={page} />
      <InstitutionalSection
        id="equipe"
        title="Profissionais"
        eyebrow="Equipe"
        action={{ label: 'Todos os profissionais', href: '/profissionais' }}
        soft
      >
        <ProfessionalGrid professionals={professionals} />
      </InstitutionalSection>
      <InstitutionalSection id="contato" title="Contato" eyebrow="Canais de contato">
        <ContactChannels settings={settings} />
      </InstitutionalSection>
    </>
  );
}
