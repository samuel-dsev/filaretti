import type { Metadata } from 'next';
import { Hero } from '@/components/site';
import { NewsletterTokenAction } from '@/components/relationship/token-action';

export const metadata: Metadata = {
  title: 'Confirmar inscrição',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function ConfirmPage() {
  return (
    <>
      <Hero title="Confirmação da newsletter" />
      <div className="f-container relationship-section">
        <NewsletterTokenAction action="confirm" />
      </div>
    </>
  );
}
