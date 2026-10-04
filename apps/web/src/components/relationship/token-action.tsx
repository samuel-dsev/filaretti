'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@filaretti/ui';
import { fragmentToken } from '@/lib/relationship-routing';
import { relationshipApi } from '@/lib/relationship-api';
import './styles.css';

export function NewsletterTokenAction({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const initialized = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setToken(fragmentToken(window.location.hash));
    window.history.replaceState(null, '', window.location.pathname);
    setReady(true);
  }, []);
  return (
    <section className="relationship-card" aria-busy={pending}>
      <h2>{action === 'confirm' ? 'Confirmar sua inscrição' : 'Cancelar sua inscrição'}</h2>
      <p>
        {action === 'confirm'
          ? 'Confirme para começar a receber os conteúdos por e-mail.'
          : 'Confirme o cancelamento para deixar de receber conteúdos por e-mail.'}
      </p>
      {!ready ? (
        <p role="status">Verificando link…</p>
      ) : done ? (
        <p role="status">
          {action === 'confirm' ? 'Inscrição confirmada.' : 'Descadastro concluído.'}
        </p>
      ) : !token ? (
        <p role="alert" className="relationship-error">
          Link inválido. Abra novamente o link recebido por e-mail.
        </p>
      ) : (
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError('');
            try {
              await relationshipApi(`newsletter/${action}`, { token });
              setToken(null);
              setDone(true);
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Não foi possível concluir.');
            } finally {
              setPending(false);
            }
          }}
        >
          {pending
            ? 'Processando…'
            : action === 'confirm'
              ? 'Confirmar inscrição'
              : 'Confirmar descadastro'}
        </Button>
      )}
      {error ? (
        <p role="alert" className="relationship-error">
          {error}
        </p>
      ) : null}
      <p>
        <Link href="/newsletter">Solicitar inscrição</Link> · <Link href="/">Voltar ao site</Link>
      </p>
    </section>
  );
}
