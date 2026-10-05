'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, FormField, Input } from '@filaretti/ui';
import { login } from '@/lib/admin-api';
import { useAdminSession } from '@/components/admin/session';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAdminSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      setUser(await login(String(values.get('email')), String(values.get('password'))));
      router.replace('/admin');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="conteudo" tabIndex={-1} className="cms-login">
      <div className="cms-login-brand">
        <p className="site-eyebrow">Filaretti Advocacia</p>
        <h1>Administração</h1>
        <p>Conteúdo, pessoas e publicações em um só lugar.</p>
        <Link href="/" prefetch={false}>
          ← Voltar ao site
        </Link>
      </div>
      <form onSubmit={submit} className="cms-login-form" aria-busy={pending}>
        <h2>Entre na sua conta</h2>
        <p>Use o acesso fornecido pelo administrador.</p>
        <FormField id="login-email" label="E-mail" required>
          {(props) => (
            <Input {...props} name="email" type="email" autoComplete="username" maxLength={254} />
          )}
        </FormField>
        <FormField id="login-password" label="Senha" required>
          {(props) => (
            <Input
              {...props}
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
            />
          )}
        </FormField>
        {error ? (
          <p role="alert" className="cms-error">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
        <Link href="/admin/recuperar-senha" prefetch={false}>
          Esqueci minha senha
        </Link>
      </form>
    </main>
  );
}
