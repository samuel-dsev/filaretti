import { LinkButton } from '@filaretti/ui';
import { Breadcrumb } from '@/components/site';
import { officeAddress } from '@/lib/office-address';
import { PublicContent } from '@/lib/public-content';
import { PageSections } from './shared';
import { OfficeMap } from './office-map';
import type { OfficeViewProps } from './types';

export function OfficeView({ page, settings }: OfficeViewProps) {
  const address = officeAddress(settings.address);
  const mapQuery = [
    settings.address.street?.replace(/,\s*sala\s+[\p{L}\d-]+(?=\s*(?:,|$))/giu, ''),
    settings.address.city,
    settings.address.state,
  ]
    .filter(Boolean)
    .join(', ');
  const mapHref = `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: mapQuery })}`;
  const firstSection = page.sections[0];
  const intro = firstSection?.key === 'intro' && !firstSection.heading ? firstSection : null;
  const sections = intro ? page.sections.slice(1) : page.sections;
  return (
    <>
      <section
        id="localizacao"
        className={`institution-office-location${address ? ' institution-office-with-map' : ''}`}
        aria-labelledby="office-heading"
      >
        <div className="institution-office-copy">
          <Breadcrumb
            items={[
              { label: 'Início', href: '/' },
              { label: 'Sobre nós', href: '/sobre-nos' },
              { label: page.title },
            ]}
          />
          <div className="institution-office-info">
            <h1 id="office-heading">{page.title}</h1>
            {page.seoDescription ? <p>{page.seoDescription}</p> : null}
            {intro ? <PublicContent document={intro.body} /> : null}
            {address ? (
              <div className="institution-office-address">
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
            ) : null}
          </div>
        </div>
        {address ? <OfficeMap query={mapQuery} /> : null}
      </section>
      {sections.length ? <PageSections page={{ ...page, sections }} /> : null}
    </>
  );
}
