'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, FormField, Input, Select, Textarea } from '@filaretti/ui';
import { relationshipApi } from '@/lib/relationship-api';
import { trackAnalytics } from '../privacy/consent-provider';
import { Antispam, type RelationshipConfiguration } from './antispam';
import './styles.css';

const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export function ContactForm({
  areas,
  config,
}: {
  areas: { id: string; name: string }[];
  config: RelationshipConfiguration;
}) {
  const id = useId();
  const key = useRef('');
  const [token, setToken] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const files = values
      .getAll('attachments')
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > 3 || files.reduce((size, file) => size + file.size, 0) > 15 * 1024 * 1024) {
      setError('Envie até três anexos, com no máximo 15 MiB no total.');
      return;
    }
    values.delete('attachments');
    for (const file of files) values.append('attachments', file);
    for (const field of ['phone', 'state', 'practiceAreaId'])
      if (!String(values.get(field) ?? '').trim()) values.delete(field);
    key.current ||= crypto.randomUUID();
    values.set('idempotencyKey', key.current);
    values.set('turnstileToken', token);
    setPending(true);
    setError('');
    setMessage('');
    try {
      await relationshipApi('contact', values);
      setMessage(
        'Solicitação recebida. A equipe poderá responder pelos dados de contato informados.',
      );
      trackAnalytics('submit_contact');
      form.reset();
      key.current = '';
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar.');
    } finally {
      setPending(false);
      setAttempt((value) => value + 1);
    }
  }
  return (
    <form className="relationship-form" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend className="f-sr-only">Enviar solicitação de contato</legend>
        <div className="relationship-grid">
          <FormField id={`${id}-name`} label="Nome" required>
            {(props) => (
              <Input {...props} name="name" autoComplete="name" minLength={2} maxLength={160} />
            )}
          </FormField>
          <FormField id={`${id}-email`} label="E-mail" required>
            {(props) => (
              <Input {...props} name="email" type="email" autoComplete="email" maxLength={254} />
            )}
          </FormField>
          <FormField id={`${id}-phone`} label="Telefone (opcional)">
            {(props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                autoComplete="tel"
                minLength={6}
                maxLength={40}
              />
            )}
          </FormField>
          <FormField id={`${id}-state`} label="Estado (opcional)">
            {(props) => (
              <Select {...props} name="state" autoComplete="address-level1">
                <option value="">Selecione o estado</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormField id={`${id}-area`} label="Área de interesse (opcional)">
          {(props) => (
            <Select {...props} name="practiceAreaId">
              <option value="">Selecione uma área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id={`${id}-subject`} label="Assunto" required>
          {(props) => <Input {...props} name="subject" minLength={3} maxLength={200} />}
        </FormField>
        <FormField
          id={`${id}-message`}
          label="Mensagem"
          required
          help="Entre 10 e 10.000 caracteres."
        >
          {(props) => (
            <Textarea {...props} name="message" minLength={10} maxLength={10000} rows={7} />
          )}
        </FormField>
        <FormField
          id={`${id}-files`}
          label="Anexos (opcional)"
          help="Até três arquivos, 15 MiB no total. PDF até 10 MiB; imagens JPEG, PNG, WebP ou AVIF até 5 MiB cada. Anexos são privados e passam por verificação."
        >
          {(props) => (
            <Input
              {...props}
              name="attachments"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.avif"
            />
          )}
        </FormField>
        <label className="relationship-checkbox">
          <input type="checkbox" name="privacyAccepted" value="true" required />
          <span>
            Li o <Link href="/privacidade">aviso de privacidade</Link> e estou ciente do tratamento
            desta solicitação. (obrigatório)
          </span>
        </label>
        <p className="relationship-note">
          A inscrição na newsletter é uma escolha separada, disponível em{' '}
          <Link href="/newsletter">Receber conteúdos</Link>.
        </p>
        <Antispam key={attempt} config={config} action="contact" onToken={setToken} />
        {error ? (
          <p role="alert" className="relationship-error">
            {error}
          </p>
        ) : null}
        <p role="status" aria-live="polite" className="relationship-success">
          {message}
        </p>
        <Button type="submit" disabled={pending || !token}>
          {pending ? 'Enviando…' : 'Enviar solicitação'}
        </Button>
      </fieldset>
    </form>
  );
}
