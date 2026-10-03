import { LinkButton, Panel } from '@filaretti/ui';

export default function FoundationPage() {
  return (
    <main id="conteudo" className="foundation" tabIndex={-1}>
      <p className="environment-label">Ambiente de desenvolvimento · F3</p>
      <h1>Fundação do projeto Filaretti</h1>
      <p className="introduction">
        Aplicação web preparada para as próximas etapas do planejamento.
      </p>

      <Panel aria-labelledby="demonstracao">
        <h2 id="demonstracao">Demonstração de desenvolvimento</h2>
        <p>
          Esta página contém apenas conteúdo fictício de demonstração. O site institucional e o
          painel administrativo serão implementados nas etapas autorizadas do plano.
        </p>
        {process.env.APP_ENV === 'development' && (
          <LinkButton href="/dev/design-system">Abrir demonstração visual</LinkButton>
        )}
      </Panel>

      <p className="foundation-note">
        A identidade visual e os materiais do escritório ainda aguardam definição e aprovação.
      </p>
    </main>
  );
}
