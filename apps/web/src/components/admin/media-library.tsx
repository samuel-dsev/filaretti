'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { PaginatedResponse } from '@filaretti/types';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Skeleton,
} from '@filaretti/ui';
import { adminApi, AdminApiError } from '@/lib/admin-api';
import type { AdminMedia } from '@/lib/admin-types';
import { ChoiceField, TextField } from './form-controls';

export function MediaLibrary() {
  const [data, setData] = useState<PaginatedResponse<AdminMedia>>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState('');
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<AdminMedia>();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const endpoint = `admin/media?page=${page}&limit=12${search ? `&q=${encodeURIComponent(search)}` : ''}${kind ? `&kind=${kind}` : ''}`;
  const load = useCallback(
    () =>
      adminApi<PaginatedResponse<AdminMedia>>(endpoint)
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar a biblioteca.',
          );
        }),
    [endpoint],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function upload() {
    if (!file) {
      setError('Selecione um arquivo.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('alt', alt);
      body.set('source', source);
      body.set('license', license);
      body.set('visibility', visibility);
      await adminApi<AdminMedia>('admin/media', { method: 'POST', body });
      setFile(undefined);
      if (input.current) input.current.value = '';
      setAlt('');
      setSource('');
      setLicense('');
      setMessage('Arquivo enviado.');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setPending(false);
    }
  }
  async function saveMedia(remove: boolean) {
    if (!selected) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await adminApi(`admin/media/${selected.id}`, {
        method: remove ? 'DELETE' : 'PATCH',
        body: JSON.stringify(
          remove
            ? { version: selected.version }
            : {
                version: selected.version,
                alt: selected.alt,
                source: selected.source,
                license: selected.license,
              },
        ),
      });
      setSelected(undefined);
      setEditing(false);
      setDeleting(false);
      setMessage(remove ? 'Arquivo excluído.' : 'Metadados salvos.');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível alterar o arquivo.');
      if (failure instanceof AdminApiError && failure.code === 'VERSION_CONFLICT')
        setConflict(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="cms-panel">
        <h2>Enviar arquivo</h2>
        <p>
          Imagens editoriais: JPG, PNG, WebP e AVIF até 5 MB. PDF até 10 MB. A validação do arquivo
          ocorre no servidor.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void upload();
          }}
        >
          <FormField id="media-upload" label="Arquivo" required>
            {(props) => (
              <Input
                {...props}
                ref={input}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.avif,.pdf"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            )}
          </FormField>
          <div className="cms-grid">
            <TextField label="Texto alternativo" value={alt} maxLength={300} onChange={setAlt} />
            <ChoiceField
              label="Visibilidade"
              value={visibility}
              options={[
                { id: 'PUBLIC', name: 'Público editorial' },
                { id: 'PRIVATE', name: 'Privado · sem URL pública' },
              ]}
              required
              onChange={setVisibility}
            />
            <TextField
              label="Origem da mídia"
              value={source}
              maxLength={500}
              onChange={setSource}
            />
            <TextField
              label="Licença ou autorização"
              value={license}
              maxLength={500}
              onChange={setLicense}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar arquivo'}
          </Button>
        </form>
      </section>
      <form
        className="cms-panel cms-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(query);
        }}
      >
        <TextField label="Buscar mídia" value={query} onChange={setQuery} />
        <ChoiceField
          label="Tipo de arquivo"
          value={kind}
          options={[
            { id: 'image', name: 'Imagens' },
            { id: 'pdf', name: 'PDFs' },
          ]}
          onChange={(value) => {
            setKind(value);
            setPage(1);
          }}
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      {error ? (
        <p role="alert" className="cms-error">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!data ? (
        error ? (
          <ErrorState
            title="Biblioteca indisponível"
            action={<Button onClick={() => void load()}>Tentar novamente</Button>}
          />
        ) : (
          <Skeleton label="Carregando mídia" height="15rem" />
        )
      ) : data.data.length ? (
        <>
          <div className="cms-media-grid">
            {data.data.map((media) => (
              <article className="cms-panel cms-media-card" key={media.id}>
                {media.url && media.mimeType.startsWith('image/') ? (
                  <div className="cms-media-thumbnail">
                    <Image
                      src={media.url}
                      alt={media.alt ?? ''}
                      width={360}
                      height={240}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="cms-media-symbol" aria-hidden="true">
                    {media.mimeType === 'application/pdf' ? 'PDF' : 'Privado'}
                  </div>
                )}
                <h3>{media.alt || `Arquivo ${media.id.slice(0, 8)}`}</h3>
                <p>
                  {media.mimeType} · {Math.ceil(media.size / 1024)} KB
                </p>
                <p>
                  <Badge variant={media.visibility === 'PUBLIC' ? 'brand' : 'neutral'}>
                    {media.visibility === 'PUBLIC' ? 'Público editorial' : 'Privado'}
                  </Badge>{' '}
                  · {media.references} referências
                </p>
                <div className="cms-actions">
                  {media.url ? (
                    <a href={media.url} target="_blank" rel="noopener noreferrer">
                      Abrir ↗
                    </a>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(media);
                      setEditing(true);
                      setConflict(false);
                      setError('');
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(media);
                      setDeleting(true);
                      setError('');
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <div className="cms-actions cms-pagination">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              Página {data.meta.page} de {data.meta.pages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= data.meta.pages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          title="Nenhum arquivo encontrado"
          description="Envie um arquivo ou altere a busca."
        />
      )}
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar metadados da mídia">
        {selected ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveMedia(false);
            }}
          >
            <TextField
              label="Texto alternativo da mídia"
              value={selected.alt}
              maxLength={300}
              onChange={(value) => setSelected({ ...selected, alt: value })}
            />
            <TextField
              label="Origem"
              value={selected.source}
              maxLength={500}
              onChange={(value) => setSelected({ ...selected, source: value })}
            />
            <TextField
              label="Licença"
              value={selected.license}
              maxLength={500}
              onChange={(value) => setSelected({ ...selected, license: value })}
            />
            {error ? (
              <p role="alert" className="cms-error">
                {error}
              </p>
            ) : null}
            {conflict ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setSelected(await adminApi<AdminMedia>(`admin/media/${selected.id}`));
                  setConflict(false);
                  setError('');
                }}
              >
                Recarregar metadados
              </Button>
            ) : null}
            <Button type="submit" disabled={pending || conflict}>
              Salvar metadados
            </Button>
          </form>
        ) : null}
      </Dialog>
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Excluir arquivo?">
        <p>Arquivos vinculados a conteúdo ou documentos de contato não podem ser excluídos.</p>
        {error ? (
          <p role="alert" className="cms-error">
            {error}
          </p>
        ) : null}
        <div className="cms-actions">
          <Button disabled={pending} onClick={() => void saveMedia(true)}>
            Confirmar exclusão
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(false)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
