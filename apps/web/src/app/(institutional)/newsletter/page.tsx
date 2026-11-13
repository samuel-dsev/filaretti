import { Breadcrumb, Hero } from '@/components/site';
import { NewsletterForm } from '@/components/relationship/newsletter-form';
import { relationshipConfiguration } from '@/components/relationship/configuration';
import { publicMetadata } from '@/lib/public-metadata';

export const metadata = publicMetadata({
  title: 'Newsletter',
  description: 'Receba por e-mail conteúdos sobre contratos e imóveis.',
  path: '/newsletter',
});

export default function NewsletterPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Newsletter' }]} />
      <Hero
        eyebrow="Conteúdos"
        title="Newsletter"
        description="Receba conteúdos sobre compra, venda, locação e regularização de imóveis. Confirme a inscrição pelo link enviado ao seu e-mail."
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
