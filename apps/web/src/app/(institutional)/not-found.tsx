import { EmptyState, LinkButton } from '@filaretti/ui';

export default function NotFound() {
  return (
    <section className="f-container foundation">
      <h1>Página não encontrada</h1>
      <EmptyState
        title="Este endereço não está disponível"
        description="Volte ao início para continuar navegando."
        action={<LinkButton href="/">Voltar ao início</LinkButton>}
      />
    </section>
  );
}
