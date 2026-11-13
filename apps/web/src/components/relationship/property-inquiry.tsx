'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, FormField, Input, Select, Textarea } from '@filaretti/ui';
import './styles.css';

export function PropertyInquiry({ whatsapp }: { whatsapp: string }) {
  const id = useId();
  const [contactType, setContactType] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const read = (key: string) => String(fields.get(key) ?? '').trim();
    const company = read('company');
    const message = [
      `Nome: ${read('firstName')} ${read('lastName')}`,
      `E-mail: ${read('email')}`,
      `Celular: ${read('phone')}`,
      `Tipo de contato: ${read('contactType')}`,
      ...(company ? [`Empresa: ${company}`] : []),
      `Tipo de serviço: ${read('service')}`,
      `Assunto: ${read('subject')}`,
      '',
      read('message'),
    ].join('\n');
    const destination = new URL(whatsapp);
    destination.searchParams.set('text', message);
    window.location.assign(destination.href);
  }

  return (
    <form className="relationship-form" onSubmit={submit} method="post">
      <div className="relationship-grid">
        <FormField id={`${id}-firstName`} label="Nome" required>
          {(props) => (
            <Input {...props} name="firstName" autoComplete="given-name" maxLength={80} />
          )}
        </FormField>
        <FormField id={`${id}-lastName`} label="Sobrenome" required>
          {(props) => (
            <Input {...props} name="lastName" autoComplete="family-name" maxLength={80} />
          )}
        </FormField>
        <FormField id={`${id}-email`} label="E-mail" required>
          {(props) => (
            <Input {...props} name="email" type="email" autoComplete="email" maxLength={254} />
          )}
        </FormField>
        <FormField id={`${id}-phone`} label="Celular" required>
          {(props) => (
            <Input
              {...props}
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+55 (XX) XXXXX-XXXX"
              maxLength={25}
            />
          )}
        </FormField>
      </div>
      <fieldset className="property-contact-type">
        <legend>
          Tipo de contato <span aria-hidden="true">*</span>
        </legend>
        {['Pessoa jurídica', 'Pessoa física'].map((type) => (
          <label className="relationship-checkbox" key={type}>
            <input
              type="radio"
              name="contactType"
              value={type}
              required
              checked={contactType === type}
              onChange={() => setContactType(type)}
            />
            {type}
          </label>
        ))}
      </fieldset>
      <FormField id={`${id}-company`} label="Empresa" required={contactType === 'Pessoa jurídica'}>
        {(props) => <Input {...props} name="company" autoComplete="organization" maxLength={160} />}
      </FormField>
      <FormField id={`${id}-service`} label="Tipo de serviço" required>
        {(props) => (
          <Select {...props} name="service" defaultValue="">
            <option value="" disabled>
              Selecione um tipo de serviço
            </option>
            <option>Compra e venda de imóveis</option>
            <option>Locação e contratos</option>
            <option>Regularização de imóveis</option>
            <option>Condomínio e cobrança</option>
            <option>Outra questão imobiliária</option>
          </Select>
        )}
      </FormField>
      <FormField id={`${id}-subject`} label="Assunto" required>
        {(props) => <Input {...props} name="subject" maxLength={160} />}
      </FormField>
      <FormField id={`${id}-message`} label="Mensagem" required>
        {(props) => <Textarea {...props} name="message" rows={5} maxLength={1200} />}
      </FormField>
      <p className="relationship-note">
        Os dados preenchem uma mensagem no WhatsApp. Revise a mensagem antes de enviá-la e consulte
        o <Link href="/privacidade">aviso de privacidade</Link>.
      </p>
      <div>
        <Button type="submit">Continuar no WhatsApp</Button>
      </div>
    </form>
  );
}
