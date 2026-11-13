import { Breadcrumb, Hero } from '@/components/site';
import { PropertyInquiry } from '@/components/relationship/property-inquiry';
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
        <div className="f-container">
          <div className="relationship-inquiry">
            {whatsapp?.startsWith('https://wa.me/') ? (
              <div>
                <h2>Solicitação de serviços</h2>
                <PropertyInquiry whatsapp={whatsapp} />
              </div>
            ) : null}
            {email ? (
              <p className="relationship-office-email">
                <a href={email}>{settings.publicEmail}</a>
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
