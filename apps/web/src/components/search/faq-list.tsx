import Link from 'next/link';
import type { PublicFaq } from '@filaretti/types';
import { Accordion, EmptyState } from '@filaretti/ui';
import { PublicContent } from '@/lib/public-content';

export function FaqList({ faqs }: { faqs: PublicFaq[] }) {
  if (!faqs.length) return <EmptyState title="Nenhuma pergunta publicada" />;
  return (
    <Accordion
      items={faqs.map((faq) => ({
        id: faq.id,
        title: faq.question,
        content: (
          <>
            <PublicContent document={faq.answer} />
            {faq.practiceArea ? (
              <p>
                <Link href={`/areas-de-atuacao/${faq.practiceArea.slug}`} prefetch={false}>
                  {faq.practiceArea.name}
                </Link>
              </p>
            ) : null}
          </>
        ),
      }))}
    />
  );
}
