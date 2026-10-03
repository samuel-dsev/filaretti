'use client';

export default function ErrorBoundary({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main id="conteudo" className="foundation" tabIndex={-1}>
      <h1>Não foi possível carregar a página</h1>
      <p>Tente novamente em alguns instantes.</p>
      <button className="return-link" onClick={reset} type="button">
        Tentar novamente
      </button>
    </main>
  );
}
