import { Breadcrumb, Hero } from '@/components/site';
import { NewsletterForm } from '@/components/relationship/newsletter-form';
import { PropertyInquiry } from '@/components/relationship/property-inquiry';
import { relationshipConfiguration } from '@/components/relationship/configuration';
import { getSettings } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';
import { safePublicUrl } from '@/lib/public-content-core';

export const metadata = publicMetadata({
  title: 'Contato',
  description: 'Fale com a Filaretti e receba conteúdos sobre contratos e imóveis.',
  path: '/contato',
});

export default async function ContactPage() {
  const settings = await getSettings();
  const whatsapp = safePublicUrl(settings.whatsappUrl);
  const email = settings.publicEmail ? safePublicUrl(`mailto:${settings.publicEmail}`) : null;
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Contato' }]} />
      </div>
      <Hero title="Contato" description="Fale com o escritório sobre sua questão imobiliária." />
      <section className="relationship-section">
        <div className="f-container relationship-columns">
          {whatsapp?.startsWith('https://wa.me/') ? (
            <div>
              <h2>Solicitação de serviços</h2>
              <PropertyInquiry whatsapp={whatsapp} />
            </div>
          ) : null}
          <aside aria-labelledby="contato-newsletter">
            {email ? (
              <p className="relationship-office-email">
                <a href={email}>{settings.publicEmail}</a>
              </p>
            ) : null}
            <div className="relationship-card">
              <h2 id="contato-newsletter">Newsletter</h2>
              <p>Receba conteúdos sobre compra, venda, locação e regularização de imóveis.</p>
              <NewsletterForm config={relationshipConfiguration()} />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
