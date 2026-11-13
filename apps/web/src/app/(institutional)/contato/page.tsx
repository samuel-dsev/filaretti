import { Breadcrumb } from '@/components/site';
import { PropertyInquiry } from '@/components/relationship/property-inquiry';
import { getSettings } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';
import { safePublicUrl } from '@/lib/public-content-core';

export const metadata = publicMetadata({
  title: 'Contato',
  description: 'Fale conosco sobre sua questão imobiliária e conte como podemos ajudar.',
  path: '/contato',
});

export default async function ContactPage() {
  const settings = await getSettings();
  const whatsapp = safePublicUrl(settings.whatsappUrl);
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Contato' }]} />
      </div>
      <section className="relationship-section">
        <div className="f-container">
          <div className="relationship-inquiry">
            <h1 className="site-hero-description relationship-inquiry-heading">
              Fale com o escritório sobre sua questão imobiliária.
            </h1>
            {whatsapp?.startsWith('https://wa.me/') ? (
              <PropertyInquiry whatsapp={whatsapp} />
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
