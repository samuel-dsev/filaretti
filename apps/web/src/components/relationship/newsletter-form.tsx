'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, FormField, Input } from '@filaretti/ui';
import { relationshipApi } from '@/lib/relationship-api';
import { trackAnalytics } from '../privacy/consent-provider';
import { Antispam, type RelationshipConfiguration } from './antispam';
import './styles.css';

export function NewsletterForm({ config }: { config: RelationshipConfiguration }) {
  const id = useId();
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError('');
    setMessage('');
    try {
      await relationshipApi('newsletter/subscribe', {
        email: String(values.get('email')),
        ...(String(values.get('name') ?? '').trim() ? { name: String(values.get('name')) } : {}),
        consent: true,
        turnstileToken: token,
      });
      setMessage(
        'Se aplicável, você receberá instruções por e-mail para confirmar a inscrição. Confira também a pasta de spam.',
      );
      trackAnalytics('newsletter_signup');
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir.');
    } finally {
      setPending(false);
      setAttempt((value) => value + 1);
    }
  }
  return (
    <form onSubmit={submit} className="relationship-form" aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend className="f-sr-only">Inscrição na newsletter</legend>
        <FormField id={`${id}-name`} label="Nome (opcional)">
          {(props) => <Input {...props} name="name" maxLength={120} autoComplete="name" />}
        </FormField>
        <FormField id={`${id}-email`} label="E-mail" required>
          {(props) => (
            <Input {...props} name="email" type="email" maxLength={254} autoComplete="email" />
          )}
        </FormField>
        <label className="relationship-checkbox">
          <input type="checkbox" name="consent" required />
          <span>
            Quero receber conteúdos por e-mail e concordo com o tratamento descrito no{' '}
            <Link href="/privacidade">aviso de privacidade</Link>. Posso cancelar a inscrição pelo
            link do e-mail.
          </span>
        </label>
        <Antispam key={attempt} config={config} action="newsletter" onToken={setToken} />
        {error ? (
          <p role="alert" className="relationship-error">
            {error}
          </p>
        ) : null}
        <p role="status" aria-live="polite" className="relationship-success">
          {message}
        </p>
        <Button type="submit" disabled={pending || !token}>
          {pending ? 'Enviando…' : 'Solicitar inscrição'}
        </Button>
      </fieldset>
    </form>
  );
}
