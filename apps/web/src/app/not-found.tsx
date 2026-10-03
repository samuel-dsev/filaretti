import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="conteudo" className="foundation" tabIndex={-1}>
      <p className="environment-label">Ambiente de desenvolvimento</p>
      <h1>Página não encontrada</h1>
      <p>Este endereço ainda não existe na aplicação.</p>
      <Link className="return-link" href="/">
        Voltar à página inicial
      </Link>
    </main>
  );
}
