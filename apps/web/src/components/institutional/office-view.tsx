import Image from 'next/image';
import { LinkButton } from '@filaretti/ui';
import { Breadcrumb, Hero } from '@/components/site';
import { officeAddress } from '@/lib/office-address';
import { InstitutionalSection, PageSections } from './shared';
import { OfficeMap } from './office-map';
import type { OfficeViewProps } from './types';

export function OfficeView({ page, settings }: OfficeViewProps) {
  const address = officeAddress(settings.address);
  const mapQuery = [
    settings.address.street,
    settings.address.city,
    settings.address.state,
    settings.address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
  const mapHref = `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: mapQuery })}`;
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Sobre nós', href: '/sobre-nos' },
            { label: 'O escritório' },
          ]}
        />
      </div>
      <Hero
        eyebrow={settings.siteName}
        title={page.title}
        description={page.seoDescription ?? undefined}
        visual={
          <figure className="institution-office-photo">
            <Image
              src="/brand/escritorio-ilustrativo.webp"
              alt="Sala de reunião com mesa de madeira e luz natural"
              width={1200}
              height={800}
              sizes="(max-width: 767px) 100vw, 46vw"
            />
            <figcaption>Imagem ilustrativa</figcaption>
          </figure>
        }
      />
      <PageSections page={page} />
      {address ? (
        <InstitutionalSection id="localizacao" title="Localização" soft>
          <div className="institution-office-location">
            <div>
              <address>{address}</address>
              <LinkButton
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
              >
                Abrir no Google Maps
              </LinkButton>
            </div>
            <OfficeMap query={mapQuery} />
          </div>
        </InstitutionalSection>
      ) : null}
    </>
  );
}
