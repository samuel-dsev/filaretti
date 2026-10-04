import { Breadcrumb, Hero } from '@/components/site';
import { NewsletterForm } from '@/components/relationship/newsletter-form';
import { relationshipConfiguration } from '@/components/relationship/configuration';
import { publicMetadata } from '@/lib/public-metadata';

export const metadata = publicMetadata({
  title: 'Newsletter',
  description: 'Solicite sua inscrição para receber conteúdos por e-mail.',
  path: '/newsletter',
});

export default function NewsletterPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Newsletter' }]} />
      <Hero
        eyebrow="Conteúdos"
        title="Receber conteúdos por e-mail"
        description="A inscrição só fica ativa depois da confirmação pelo link enviado ao seu e-mail. Você pode cancelar quando desejar."
      />
      <section className="relationship-section">
        <div className="f-container">
          <div className="relationship-card">
            <NewsletterForm config={relationshipConfiguration()} />
          </div>
        </div>
      </section>
    </>
  );
}
