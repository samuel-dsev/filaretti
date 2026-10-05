'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, FormField, Input } from '@filaretti/ui';
import { adminApi, obtainCsrf } from '@/lib/admin-api';
import { recoveryFragmentToken } from '@/lib/relationship-routing';

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const initialized = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(!reset);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!reset || initialized.current) return;
    initialized.current = true;
    setToken(recoveryFragmentToken(window.location.hash));
    window.history.replaceState(null, '', window.location.pathname);
    setReady(true);
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (reset && (!token || values.get('password') !== values.get('confirm'))) {
      setError('As senhas precisam ser iguais.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      await obtainCsrf();
      await adminApi(
        reset ? 'auth/password/reset' : 'auth/password/recovery',
        {
          method: 'POST',
          body: JSON.stringify(
            reset
              ? { token, newPassword: String(values.get('password')) }
              : { email: String(values.get('email')) },
          ),
        },
        false,
      );
      setMessage(
        reset
          ? 'Senha redefinida. Entre novamente com a nova senha.'
          : 'Se a conta estiver cadastrada e ativa, você receberá instruções no e-mail informado.',
      );
      form.reset();
      if (reset) setToken(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="conteudo" tabIndex={-1} className="cms-login">
      <div className="cms-login-brand">
        <p className="site-eyebrow">Filaretti Advocacia</p>
        <h1>{reset ? 'Nova senha' : 'Recuperar acesso'}</h1>
        <p>
          {reset
            ? 'Escolha uma nova senha para sua conta administrativa.'
            : 'Receba um link de recuperação no seu e-mail.'}
        </p>
        <Link href="/admin/login">← Voltar ao login</Link>
      </div>
      <form onSubmit={submit} className="cms-login-form" aria-busy={pending}>
        <h2>{reset ? 'Redefinir senha' : 'Solicitar recuperação'}</h2>
        {!ready ? (
          <p role="status">Verificando link…</p>
        ) : reset && !token && !message ? (
          <p role="alert" className="cms-error">
            Link inválido. Solicite um novo link de recuperação.
          </p>
        ) : !message || !reset ? (
          <fieldset
            disabled={pending}
            style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '1rem', minWidth: 0 }}
          >
            <legend className="f-sr-only">{reset ? 'Nova senha' : 'E-mail de recuperação'}</legend>
            {reset ? (
              <>
                <FormField
                  id="reset-password"
                  label="Nova senha"
                  required
                  help="Entre 12 e 128 caracteres."
                >
                  {(props) => (
                    <Input
                      {...props}
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  )}
                </FormField>
                <FormField id="reset-confirm" label="Confirmar nova senha" required>
                  {(props) => (
                    <Input
                      {...props}
                      name="confirm"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  )}
                </FormField>
              </>
            ) : (
              <FormField id="recovery-email" label="E-mail" required>
                {(props) => (
                  <Input
                    {...props}
                    name="email"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                  />
                )}
              </FormField>
            )}
            <Button type="submit" disabled={pending || (reset && !token)}>
              {pending ? 'Processando…' : reset ? 'Salvar nova senha' : 'Solicitar link'}
            </Button>
          </fieldset>
        ) : null}
        {error ? (
          <p role="alert" className="cms-error">
            {error}
          </p>
        ) : null}
        <p role="status" aria-live="polite">
          {message}
        </p>
        {reset ? <Link href="/admin/recuperar-senha">Solicitar novo link</Link> : null}
      </form>
    </main>
  );
}
