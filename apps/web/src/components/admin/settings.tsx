'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { PublicSiteSettings } from '@filaretti/types';
import { Button, Dialog, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi, AdminApiError } from '@/lib/admin-api';
import { TextField } from './form-controls';

interface SettingsRecord extends PublicSiteSettings {
  version: number;
}
const addressLabels: Record<string, string> = {
  street: 'Rua e número',
  city: 'Cidade',
  state: 'Estado',
  postalCode: 'CEP',
  country: 'País',
};

export function Settings() {
  const [data, setData] = useState<SettingsRecord>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  function load() {
    return adminApi<SettingsRecord>('admin/settings')
      .then((result) => {
        setData(result);
        setError('');
        setConflict(false);
      })
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error ? failure.message : 'Não foi possível carregar a configuração.',
        );
      });
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const { siteName, publicEmail, publicPhone, whatsappUrl, address, socialLinks, version } =
        data;
      setData(
        await adminApi<SettingsRecord>('admin/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            siteName,
            publicEmail: publicEmail || null,
            publicPhone: publicPhone || null,
            whatsappUrl: whatsappUrl || null,
            address,
            socialLinks,
            version,
          }),
        }),
      );
      setMessage('Configurações salvas.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
      if (failure instanceof AdminApiError && failure.code === 'VERSION_CONFLICT')
        setConflict(true);
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return error ? (
      <ErrorState
        title="Configurações indisponíveis"
        description={error}
        action={<Button onClick={() => void load()}>Tentar novamente</Button>}
      />
    ) : (
      <Skeleton label="Carregando configurações" height="15rem" />
    );
  return (
    <>
      <form onSubmit={submit} className="cms-form" aria-busy={pending}>
        <fieldset disabled={pending} className="cms-form-fields">
          <legend className="f-sr-only">Configurações públicas do site</legend>
          <section className="cms-panel">
            <h2>Identificação e contato</h2>
            <TextField
              label="Nome do site"
              value={data.siteName}
              required
              maxLength={160}
              onChange={(value) => setData({ ...data, siteName: value })}
            />
            <div className="cms-grid">
              <TextField
                label="E-mail público"
                value={data.publicEmail}
                type="email"
                maxLength={254}
                onChange={(value) => setData({ ...data, publicEmail: value })}
              />
              <TextField
                label="Telefone público"
                value={data.publicPhone}
                type="tel"
                maxLength={40}
                onChange={(value) => setData({ ...data, publicPhone: value })}
              />
            </div>
            <TextField
              label="Link do WhatsApp"
              value={data.whatsappUrl}
              maxLength={500}
              help="Informe o endereço HTTPS aprovado pelo escritório."
              onChange={(value) => setData({ ...data, whatsappUrl: value })}
            />
          </section>
          <section className="cms-panel">
            <h2>Endereço público</h2>
            <div className="cms-grid">
              {Object.entries(addressLabels).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={data.address[key] ?? ''}
                  maxLength={
                    key === 'street'
                      ? 200
                      : key === 'state'
                        ? 50
                        : key === 'postalCode'
                          ? 20
                          : key === 'country'
                            ? 80
                            : 100
                  }
                  onChange={(value) =>
                    setData({ ...data, address: { ...data.address, [key]: value } })
                  }
                />
              ))}
            </div>
          </section>
          <section className="cms-panel">
            <h2>Redes e links públicos</h2>
            {data.socialLinks.map((link, index) => (
              <div key={index} className="cms-social-link">
                <TextField
                  label={`Nome do link ${index + 1}`}
                  value={link.label}
                  required
                  maxLength={80}
                  onChange={(value) =>
                    setData({
                      ...data,
                      socialLinks: data.socialLinks.map((item, position) =>
                        position === index ? { ...item, label: value } : item,
                      ),
                    })
                  }
                />
                <TextField
                  label={`Endereço do link ${index + 1}`}
                  value={link.url}
                  required
                  maxLength={500}
                  onChange={(value) =>
                    setData({
                      ...data,
                      socialLinks: data.socialLinks.map((item, position) =>
                        position === index ? { ...item, url: value } : item,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setData({
                      ...data,
                      socialLinks: data.socialLinks.filter((_, position) => position !== index),
                    })
                  }
                >
                  Remover link {index + 1}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={data.socialLinks.length >= 15}
              onClick={() =>
                setData({ ...data, socialLinks: [...data.socialLinks, { label: '', url: '' }] })
              }
            >
              Adicionar link
            </Button>
          </section>
        </fieldset>
        {error ? (
          <p role="alert" className="cms-error">
            {error}
          </p>
        ) : null}
        <p role="status" aria-live="polite">
          {message}
        </p>
        {conflict ? (
          <Button type="button" variant="secondary" onClick={() => setReloadOpen(true)}>
            Recarregar configurações
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || conflict}>
          {pending ? 'Salvando…' : 'Salvar configurações'}
        </Button>
      </form>
      <Dialog
        open={reloadOpen}
        onClose={() => setReloadOpen(false)}
        title="Recarregar configurações?"
      >
        <p>As alterações desta tela serão substituídas pela versão atual do servidor.</p>
        <Button
          onClick={async () => {
            await load();
            setReloadOpen(false);
          }}
        >
          Recarregar
        </Button>
      </Dialog>
    </>
  );
}
