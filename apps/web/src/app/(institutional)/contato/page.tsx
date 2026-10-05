import Link from 'next/link';
import { Breadcrumb, Hero } from '@/components/site';
import { ContactForm } from '@/components/relationship/contact-form';
import { relationshipConfiguration } from '@/components/relationship/configuration';
import { getPracticeAreas, getSettings } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';
import { safePublicUrl } from '@/lib/public-content-core';

export const metadata = publicMetadata({
  title: 'Contato',
  description:
    'Entre em contato com o escritório pelos canais disponíveis ou envie uma solicitação.',
  path: '/contato',
});

export default async function ContactPage() {
  const [settings, areas] = await Promise.all([getSettings(), getPracticeAreas({ limit: 50 })]);
  const whatsapp = safePublicUrl(settings.whatsappUrl);
  const email = settings.publicEmail ? safePublicUrl(`mailto:${settings.publicEmail}`) : null;
  const phone = settings.publicPhone
    ? safePublicUrl(`tel:${settings.publicPhone.replace(/[^\d+]/gu, '')}`)
    : null;
  const address = Object.values(settings.address).filter(Boolean).join(', ');
  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Contato' }]} />
      </div>
      <Hero
        eyebrow="Relacionamento"
        title="Contato"
        description="Envie sua solicitação ou converse pelos canais disponíveis."
      />
      <section className="relationship-section">
        <div className="f-container relationship-columns">
          <div>
            <h2>Enviar uma solicitação</h2>
            <ContactForm areas={areas.data} config={relationshipConfiguration()} />
          </div>
          <aside>
            <h2>Canais do escritório</h2>
            <div className="relationship-channel">
              <dl>
                {email ? (
                  <div>
                    <dt>E-mail</dt>
                    <dd>
                      <a href={email}>{settings.publicEmail}</a>
                    </dd>
                  </div>
                ) : null}
                {phone ? (
                  <div>
                    <dt>Telefone</dt>
                    <dd>
                      <a href={phone}>{settings.publicPhone}</a>
                    </dd>
                  </div>
                ) : null}
                {address ? (
                  <div>
                    <dt>Endereço</dt>
                    <dd>
                      <address>{address}</address>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {whatsapp ? (
                <a
                  className="f-button f-button--primary"
                  href={whatsapp}
                  data-analytics-event="click_whatsapp"
                >
                  Conversar pelo WhatsApp ↗
                </a>
              ) : null}
              {!email && !phone && !address && !whatsapp ? <p>Canais em preparação.</p> : null}
            </div>
            <div className="relationship-channel">
              <h3>Conteúdos por e-mail</h3>
              <p>A newsletter tem inscrição e confirmação próprias.</p>
              <Link href="/newsletter">Receber conteúdos →</Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
