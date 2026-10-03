'use client';

import { Button, ErrorState } from '@filaretti/ui';

export default function InstitutionalError({ reset }: { reset: () => void }) {
  return (
    <section className="f-container foundation">
      <h1>Conteúdo temporariamente indisponível</h1>
      <ErrorState
        title="Não foi possível carregar as informações"
        description="Tente novamente em alguns instantes."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </section>
  );
}
