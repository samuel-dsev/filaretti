import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="conteudo" className="foundation" tabIndex={-1}>
      <p className="environment-label">404</p>
      <h1>Página não encontrada</h1>
      <p>Este endereço não está disponível. Volte ao início para continuar navegando.</p>
      <Link className="return-link" href="/">
        Voltar à página inicial
      </Link>
    </main>
  );
}
