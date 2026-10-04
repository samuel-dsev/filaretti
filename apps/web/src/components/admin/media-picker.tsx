'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Button, FormField, Input, Select } from '@filaretti/ui';
import { adminApi, adminOptions } from '@/lib/admin-api';
import type { AdminMedia } from '@/lib/admin-types';

export function MediaPicker({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: 'image' | 'pdf';
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  const [options, setOptions] = useState<AdminMedia[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState('');
  const load = useCallback(
    () =>
      adminOptions<AdminMedia>('admin/media')
        .then((records) => {
          setOptions(
            records.filter(
              (media) =>
                media.visibility === 'PUBLIC' &&
                (kind === 'pdf'
                  ? media.mimeType === 'application/pdf'
                  : media.mimeType.startsWith('image/')),
            ),
          );
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar a mídia.',
          );
        })
        .finally(() => {
          setLoading(false);
        }),
    [kind],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const selected = options.find((media) => media.id === value);
  async function upload() {
    if (!file) {
      setError('Selecione um arquivo.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('alt', alt);
      body.set('visibility', 'PUBLIC');
      const media = await adminApi<AdminMedia>('admin/media', { method: 'POST', body });
      await load();
      onChange(media.id);
      setFile(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setSending(false);
    }
  }
  return (
    <fieldset className="cms-media-picker">
      <legend>{label}</legend>
      <FormField
        id={`${id}-select`}
        label={`Selecionar ${label.toLowerCase()}`}
        help={
          loading ? 'Carregando biblioteca…' : `${options.length} arquivos editoriais disponíveis.`
        }
      >
        {(props) => (
          <Select
            {...props}
            value={value ?? ''}
            disabled={loading}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">Sem arquivo</option>
            {value && !selected ? (
              <option value={value}>Arquivo atual indisponível na biblioteca</option>
            ) : null}
            {options.map((media) => (
              <option key={media.id} value={media.id}>
                {media.alt || `${media.mimeType} · ${media.id.slice(0, 8)}`} ·{' '}
                {Math.ceil(media.size / 1024)} KB
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {selected?.url ? (
        <a href={selected.url} target="_blank" rel="noopener noreferrer">
          Abrir arquivo selecionado ↗
        </a>
      ) : null}
      <details>
        <summary>Enviar novo arquivo</summary>
        <FormField
          id={`${id}-file`}
          label={`Arquivo para ${label.toLowerCase()}`}
          help={kind === 'image' ? 'JPG, PNG, WebP ou AVIF; até 5 MB.' : 'PDF; até 10 MB.'}
        >
          {(props) => (
            <Input
              {...props}
              type="file"
              accept={kind === 'image' ? '.jpg,.jpeg,.png,.webp,.avif' : '.pdf'}
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          )}
        </FormField>
        <FormField
          id={`${id}-alt`}
          label="Texto alternativo"
          help="Descreva a imagem para quem não consegue vê-la."
        >
          {(props) => (
            <Input
              {...props}
              value={alt}
              maxLength={300}
              onChange={(event) => setAlt(event.target.value)}
            />
          )}
        </FormField>
        <Button type="button" variant="secondary" disabled={sending} onClick={() => void upload()}>
          {sending ? 'Enviando…' : 'Enviar arquivo'}
        </Button>
      </details>
      {error ? (
        <p role="alert" className="cms-error">
          {error}{' '}
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Recarregar biblioteca
          </Button>
        </p>
      ) : null}
    </fieldset>
  );
}
