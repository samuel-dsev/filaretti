import type { Metadata } from 'next';
import { Hero } from '@/components/site';
import { NewsletterTokenAction } from '@/components/relationship/token-action';

export const metadata: Metadata = {
  title: 'Cancelar inscrição',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function UnsubscribePage() {
  return (
    <>
      <Hero title="Descadastro da newsletter" />
      <div className="f-container relationship-section">
        <NewsletterTokenAction action="unsubscribe" />
      </div>
    </>
  );
}
