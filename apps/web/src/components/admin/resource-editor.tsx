'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicationStatus } from '@filaretti/types';
import { Badge, Button, Dialog, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi, AdminApiError, adminOptions, publicOptions } from '@/lib/admin-api';
import {
  blankEntity,
  emptyDocument,
  entityPayload,
  resources,
  statusLabels,
  type AdminEntity,
  type ResourceKey,
} from '@/lib/admin-types';
import { CheckField, ChoiceField, LinesField, RelationFields, TextField } from './form-controls';
import { MediaPicker } from './media-picker';
import { RichEditor } from './rich-editor';
import { useAdminSession } from './session';

interface Option {
  id: string;
  name: string;
  isActive?: boolean;
}
const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 120);
const localSchedule = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(new Date(value))
        .replace(' ', 'T')
    : '';

export function ResourceEditor({ kind, recordId }: { kind: ResourceKey; recordId?: string }) {
  const router = useRouter();
  const { user } = useAdminSession();
  const resource = resources[kind];
  const [entity, setEntity] = useState<AdminEntity>(blankEntity);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<'delete' | 'reload' | null>(null);
  const [schedule, setSchedule] = useState('');
  const [preview, setPreview] = useState<{ token: string; expiresAt: string }>();
  const [options, setOptions] = useState<{
    authors: Option[];
    categories: Option[];
    tags: Option[];
    areas: Option[];
  }>({ authors: [], categories: [], tags: [], areas: [] });
  const path = `admin/${resource.endpoint}`;
  const role = user?.role;
  const load = useCallback(
    () =>
      (recordId ? adminApi<AdminEntity>(`${path}/${recordId}`) : Promise.resolve(blankEntity()))
        .then(async (record) => {
          const optionsFor = (
            path: 'professionals' | 'practice-areas' | 'taxonomies/categories' | 'taxonomies/tags',
          ) =>
            role === 'AUTHOR' ? publicOptions<Option>(path) : adminOptions<Option>(`admin/${path}`);
          const authors = kind === 'artigos' ? optionsFor('professionals') : Promise.resolve([]);
          const categories =
            kind === 'artigos' ? optionsFor('taxonomies/categories') : Promise.resolve([]);
          const tags = kind === 'artigos' ? optionsFor('taxonomies/tags') : Promise.resolve([]);
          const areas = ['artigos', 'profissionais', 'faq'].includes(kind)
            ? optionsFor('practice-areas')
            : Promise.resolve([]);
          const result = await Promise.all([authors, categories, tags, areas]);
          return { record, result };
        })
        .then(({ record, result }) => {
          setEntity({ ...blankEntity(), ...record });
          setSchedule(localSchedule(record.scheduledAt));
          setDirty(false);
          setConflict(false);
          setPreview(undefined);
          setError('');
          setOptions({
            authors: result[0]!,
            categories: result[1]!,
            tags: result[2]!,
            areas: result[3]!,
          });
          setLoaded(true);
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar o registro.',
          );
        }),
    [kind, recordId, path, role],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  function change<K extends keyof AdminEntity>(key: K, value: AdminEntity[K]) {
    setEntity((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage('');
  }
  function failure(error: unknown) {
    setError(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    if (error instanceof AdminApiError && error.code === 'VERSION_CONFLICT') setConflict(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const payload = entityPayload(kind, entity);
      const record = await adminApi<AdminEntity>(entity.id ? `${path}/${entity.id}` : path, {
        method: entity.id ? 'PATCH' : 'POST',
        body: JSON.stringify(entity.id ? { ...payload, version: entity.version } : payload),
      });
      setEntity({ ...blankEntity(), ...record });
      setDirty(false);
      setConflict(false);
      setMessage('Alterações salvas.');
      setPreview(undefined);
      if (!entity.id) router.replace(`/admin/${kind}/${record.id}`);
    } catch (error) {
      failure(error);
    } finally {
      setPending(false);
    }
  }
  async function publication(status: PublicationStatus) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const scheduledAt =
        status === 'SCHEDULED' && schedule
          ? new Date(`${schedule}:00-03:00`).toISOString()
          : undefined;
      const record = await adminApi<AdminEntity>(`${path}/${entity.id}/publication`, {
        method: 'POST',
        body: JSON.stringify({
          version: entity.version,
          status,
          ...(scheduledAt ? { scheduledAt } : {}),
        }),
      });
      setEntity({ ...blankEntity(), ...record });
      setDirty(false);
      setMessage(`Publicação atualizada: ${statusLabels[record.status]}.`);
      setSchedule(localSchedule(record.scheduledAt));
      setPreview(undefined);
    } catch (error) {
      failure(error);
    } finally {
      setPending(false);
    }
  }
  async function previewAction(revoke = false) {
    setPending(true);
    setError('');
    try {
      if (revoke) {
        await adminApi(`${path}/${entity.id}/preview`, {
          method: 'DELETE',
          body: JSON.stringify({ version: entity.version }),
        });
        setPreview(undefined);
        setMessage('Links de preview revogados.');
      } else {
        setPreview(
          await adminApi<{ token: string; expiresAt: string }>(`${path}/${entity.id}/preview`, {
            method: 'POST',
            body: JSON.stringify({ version: entity.version }),
          }),
        );
      }
    } catch (error) {
      failure(error);
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    setConfirmation(null);
    if (confirmation === 'reload') {
      await load();
      return;
    }
    setPending(true);
    setError('');
    try {
      await adminApi(`${path}/${entity.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: entity.version }),
      });
      setDirty(false);
      router.push(`/admin/${kind}`);
    } catch (error) {
      failure(error);
    } finally {
      setPending(false);
    }
  }
  if (!loaded)
    return error ? (
      <ErrorState
        headingLevel={2}
        title="Registro indisponível"
        description={error}
        action={<Button onClick={() => void load()}>Tentar novamente</Button>}
      />
    ) : (
      <Skeleton label="Carregando registro e relacionamentos" height="18rem" />
    );
  const publicationKind = kind === 'artigos' || kind === 'paginas';
  const writable = user?.role !== 'AUTHOR' || (kind === 'artigos' && entity.status === 'DRAFT');
  const saved = Boolean(entity.id);
  return (
    <>
      <div className="cms-editor-heading">
        <a href={`/admin/${kind}`}>← Voltar à listagem</a>
        {publicationKind ? (
          <Badge variant={entity.status === 'PUBLISHED' ? 'success' : 'neutral'}>
            {statusLabels[entity.status]}
          </Badge>
        ) : null}
        <span>{saved ? `Versão ${entity.version}` : `Novo ${resource.singular}`}</span>
      </div>
      <form onSubmit={submit} aria-busy={pending} className="cms-form">
        <fieldset disabled={pending || !writable} className="cms-form-fields">
          <legend className="f-sr-only">Dados do {resource.singular}</legend>
          <section className="cms-panel">
            <h2>{saved ? `Editar ${resource.singular}` : `Novo ${resource.singular}`}</h2>
            {kind !== 'faq' && kind !== 'redirects' ? (
              <div className="cms-grid">
                <TextField
                  label={['artigos', 'paginas'].includes(kind) ? 'Título' : 'Nome'}
                  value={['artigos', 'paginas'].includes(kind) ? entity.title : entity.name}
                  required
                  maxLength={['artigos', 'paginas'].includes(kind) ? 200 : 120}
                  onChange={(value) => {
                    const key = ['artigos', 'paginas'].includes(kind) ? 'title' : 'name';
                    change(key, value);
                    if (!saved && (!entity.slug || entity.slug === slugify(entity[key])))
                      change('slug', slugify(value));
                  }}
                />
                <TextField
                  label="Slug"
                  value={entity.slug}
                  required
                  maxLength={120}
                  disabled={
                    kind === 'paginas' &&
                    saved &&
                    ['home', 'o-escritorio', 'privacidade', 'cookies'].includes(entity.slug)
                  }
                  help={
                    kind === 'paginas'
                      ? 'As páginas alimentam os templates institucionais existentes. O slug das páginas estruturais é preservado.'
                      : 'Letras minúsculas, números e hífens. Ao alterar uma URL publicada, a anterior será preservada por redirecionamento.'
                  }
                  onChange={(value) => change('slug', value)}
                />
              </div>
            ) : null}
            {kind === 'artigos' ? (
              <>
                <TextField
                  label="Resumo"
                  value={entity.excerpt}
                  multiline
                  maxLength={500}
                  onChange={(value) => change('excerpt', value)}
                />
                <div className="cms-grid">
                  <ChoiceField
                    label="Tipo"
                    value={entity.type}
                    required
                    options={[
                      { id: 'ARTICLE', name: 'Artigo' },
                      { id: 'UPDATE', name: 'Atualização' },
                      { id: 'GUIDE', name: 'Guia' },
                    ]}
                    onChange={(value) => change('type', value as AdminEntity['type'])}
                  />
                  <ChoiceField
                    label="Autor profissional"
                    value={entity.authorId}
                    required
                    options={options.authors}
                    help="Profissional exibido no site. A propriedade administrativa é definida pela sessão."
                    onChange={(value) => change('authorId', value)}
                  />
                </div>
                <RichEditor
                  disabled={pending || !writable}
                  label="Conteúdo"
                  value={entity.content}
                  onChange={(value) => change('content', value)}
                />
                <CheckField
                  label="Destacar na página inicial"
                  checked={entity.featured}
                  onChange={(value) => change('featured', value)}
                />
              </>
            ) : null}
            {kind === 'areas' ? (
              <>
                <TextField
                  label="Resumo"
                  value={entity.summary}
                  multiline
                  maxLength={500}
                  onChange={(value) => change('summary', value)}
                />
                <RichEditor
                  disabled={pending || !writable}
                  label="Descrição da área"
                  value={entity.description}
                  onChange={(value) => change('description', value)}
                />
                <LinesField
                  label="Serviços"
                  values={entity.services}
                  onChange={(value) => change('services', value)}
                />
              </>
            ) : null}
            {kind === 'profissionais' ? (
              <>
                <TextField
                  label="Cargo ou título profissional"
                  value={entity.title}
                  maxLength={160}
                  onChange={(value) => change('title', value)}
                />
                <RichEditor
                  disabled={pending || !writable}
                  label="Biografia"
                  value={entity.bio}
                  onChange={(value) => change('bio', value)}
                />
                <div className="cms-grid">
                  <LinesField
                    label="Formação"
                    values={entity.education}
                    onChange={(value) => change('education', value)}
                  />
                  <LinesField
                    label="Experiência"
                    values={entity.experience}
                    onChange={(value) => change('experience', value)}
                  />
                </div>
              </>
            ) : null}
            {kind === 'faq' ? (
              <>
                <TextField
                  label="Pergunta"
                  value={entity.question}
                  required
                  maxLength={300}
                  onChange={(value) => change('question', value)}
                />
                <RichEditor
                  disabled={pending || !writable}
                  label="Resposta"
                  value={entity.answer}
                  onChange={(value) => change('answer', value)}
                />
                <ChoiceField
                  label="Área de atuação"
                  value={entity.practiceAreaId ?? ''}
                  options={options.areas}
                  help="Deixe sem seleção para uma pergunta global."
                  onChange={(value) => change('practiceAreaId', value || null)}
                />
              </>
            ) : null}
            {kind === 'redirects' ? (
              <>
                <div className="cms-grid">
                  <TextField
                    label="Caminho de origem"
                    value={entity.sourcePath}
                    required
                    help="Exemplo: /conteudos/slug-anterior"
                    onChange={(value) => change('sourcePath', value)}
                  />
                  <TextField
                    label="Caminho de destino"
                    value={entity.targetPath}
                    required
                    help="Use um caminho interno; sem query, fragmento ou domínio externo."
                    onChange={(value) => change('targetPath', value)}
                  />
                </div>
                <ChoiceField
                  label="Código HTTP"
                  value={String(entity.statusCode)}
                  required
                  options={[
                    { id: '301', name: '301 · Permanente' },
                    { id: '302', name: '302 · Temporário' },
                    { id: '307', name: '307 · Temporário, preserva método' },
                    { id: '308', name: '308 · Permanente, preserva método' },
                  ]}
                  onChange={(value) => change('statusCode', Number(value))}
                />
              </>
            ) : null}
            {kind === 'paginas' ? (
              <div className="cms-sections">
                <h3>Seções da página</h3>
                {entity.sections.length ? (
                  entity.sections.map((section, index) => (
                    <section key={index} className="cms-section">
                      <div className="cms-grid">
                        <TextField
                          label={`Chave da seção ${index + 1}`}
                          value={section.key}
                          required
                          maxLength={80}
                          onChange={(value) =>
                            change(
                              'sections',
                              entity.sections.map((item, position) =>
                                position === index ? { ...item, key: value } : item,
                              ),
                            )
                          }
                        />
                        <TextField
                          label={`Título da seção ${index + 1}`}
                          value={section.heading ?? ''}
                          maxLength={200}
                          onChange={(value) =>
                            change(
                              'sections',
                              entity.sections.map((item, position) =>
                                position === index ? { ...item, heading: value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <RichEditor
                        disabled={pending || !writable}
                        label={`Texto da seção ${index + 1}`}
                        value={section.body}
                        onChange={(value) =>
                          change(
                            'sections',
                            entity.sections.map((item, position) =>
                              position === index ? { ...item, body: value } : item,
                            ),
                          )
                        }
                      />
                      <div className="cms-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => {
                            const sections = [...entity.sections];
                            [sections[index - 1], sections[index]] = [
                              sections[index]!,
                              sections[index - 1]!,
                            ];
                            change('sections', sections);
                          }}
                        >
                          Mover para cima
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            change(
                              'sections',
                              entity.sections.filter((_, position) => position !== index),
                            )
                          }
                        >
                          Remover seção {index + 1}
                        </Button>
                      </div>
                    </section>
                  ))
                ) : (
                  <p>Nenhuma seção. Adicione a primeira para começar.</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={entity.sections.length >= 30}
                  onClick={() =>
                    change('sections', [
                      ...entity.sections,
                      {
                        key: `secao-${entity.sections.length + 1}`,
                        heading: '',
                        body: emptyDocument(),
                      },
                    ])
                  }
                >
                  Adicionar seção
                </Button>
              </div>
            ) : null}
            {!publicationKind ? (
              <CheckField
                label="Registro ativo"
                checked={entity.isActive}
                onChange={(value) => change('isActive', value)}
              />
            ) : null}
            {['areas', 'profissionais', 'faq'].includes(kind) ? (
              <TextField
                label="Ordem de exibição"
                type="number"
                value={String(entity.sortOrder)}
                help="De 0 a 10000; valores menores aparecem primeiro."
                onChange={(value) => change('sortOrder', Number(value))}
              />
            ) : null}
          </section>
          {['artigos', 'profissionais'].includes(kind) ? (
            <section className="cms-panel">
              <h2>Relacionamentos</h2>
              {kind === 'artigos' ? (
                <>
                  <RelationFields
                    label="Categorias"
                    values={entity.categoryIds}
                    options={options.categories}
                    onChange={(value) => change('categoryIds', value)}
                  />
                  <RelationFields
                    label="Tags"
                    values={entity.tagIds}
                    options={options.tags}
                    onChange={(value) => change('tagIds', value)}
                  />
                </>
              ) : null}
              <RelationFields
                label="Áreas de atuação"
                values={entity.practiceAreaIds}
                options={options.areas}
                onChange={(value) => change('practiceAreaIds', value)}
              />
            </section>
          ) : null}
          {['artigos', 'profissionais'].includes(kind) ? (
            <section className="cms-panel">
              <h2>Mídia editorial</h2>
              <MediaPicker
                label={kind === 'artigos' ? 'Capa' : 'Foto'}
                kind="image"
                value={kind === 'artigos' ? entity.coverMediaId : entity.photoMediaId}
                onChange={(value) =>
                  change(kind === 'artigos' ? 'coverMediaId' : 'photoMediaId', value)
                }
              />
              {kind === 'artigos' && entity.type === 'GUIDE' ? (
                <MediaPicker
                  label="PDF do guia"
                  kind="pdf"
                  value={entity.pdfMediaId}
                  onChange={(value) => change('pdfMediaId', value)}
                />
              ) : null}
            </section>
          ) : null}
          {publicationKind ? (
            <section className="cms-panel">
              <h2>SEO</h2>
              <TextField
                label="Título SEO"
                value={entity.seoTitle}
                maxLength={70}
                help="Até 70 caracteres; se vazio, será usado o título do conteúdo."
                onChange={(value) => change('seoTitle', value || null)}
              />
              <TextField
                label="Descrição SEO"
                value={entity.seoDescription}
                multiline
                maxLength={170}
                help="Até 170 caracteres."
                onChange={(value) => change('seoDescription', value || null)}
              />
            </section>
          ) : null}
        </fieldset>
        {error ? (
          <p className="cms-error" role="alert">
            {error}
          </p>
        ) : null}
        {conflict ? (
          <Button type="button" variant="secondary" onClick={() => setConfirmation('reload')}>
            Recarregar registro
          </Button>
        ) : null}
        <div className="cms-savebar">
          <p role="status" aria-live="polite">
            {message ||
              (dirty ? 'Há alterações não salvas.' : 'Todos os campos estão atualizados.')}
          </p>
          <Button type="submit" disabled={pending || !writable || conflict}>
            {pending
              ? 'Salvando…'
              : !saved && publicationKind
                ? 'Salvar rascunho'
                : 'Salvar alterações'}
          </Button>
        </div>
      </form>
      {saved && publicationKind ? (
        <section className="cms-panel cms-publication">
          <h2>Publicação</h2>
          {dirty ? (
            <p>Salve suas alterações antes de gerar um preview ou mudar a publicação.</p>
          ) : null}
          {entity.scheduledAt ? (
            <p>
              Agendado para{' '}
              {new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(entity.scheduledAt))}{' '}
              · America/Sao_Paulo.
            </p>
          ) : null}
          <div className="cms-actions">
            {kind === 'artigos' ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || dirty || conflict}
                  onClick={() => void previewAction()}
                >
                  Gerar preview
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || dirty || conflict}
                  onClick={() => void previewAction(true)}
                >
                  Revogar previews
                </Button>
              </>
            ) : null}
            {user?.role !== 'AUTHOR' ? (
              <>
                <Button
                  type="button"
                  disabled={pending || dirty || conflict || entity.status === 'PUBLISHED'}
                  onClick={() => void publication('PUBLISHED')}
                >
                  Publicar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || dirty || conflict || entity.status === 'DRAFT'}
                  onClick={() => void publication('DRAFT')}
                >
                  Retirar de publicação
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || dirty || conflict || entity.status === 'ARCHIVED'}
                  onClick={() => void publication('ARCHIVED')}
                >
                  Arquivar
                </Button>
              </>
            ) : (
              <p>O editor aprova e publica seus rascunhos.</p>
            )}
          </div>
          {preview ? (
            <p className="cms-preview-link">
              <a
                href={`/preview/${encodeURIComponent(preview.token)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir preview ↗
              </a>
              <span>
                Válido até{' '}
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(preview.expiresAt))}
                . Compartilhe somente com quem revisará o conteúdo.
              </span>
            </p>
          ) : null}
          {kind === 'artigos' && user?.role !== 'AUTHOR' ? (
            <div className="cms-schedule">
              <TextField
                label="Data e hora do agendamento"
                type="datetime-local"
                value={schedule}
                help="Horário de Brasília (America/Sao_Paulo). A API armazena a data em UTC."
                onChange={setSchedule}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || dirty || conflict || !schedule}
                onClick={() => void publication('SCHEDULED')}
              >
                Agendar
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {saved && writable ? (
        <section className="cms-danger">
          <h2>Excluir registro</h2>
          <p>
            Registros publicados ou em uso precisam ser retirados dos vínculos antes da exclusão.
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || conflict}
            onClick={() => setConfirmation('delete')}
          >
            Excluir {resource.singular}
          </Button>
        </section>
      ) : null}
      <Dialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        title={confirmation === 'reload' ? 'Recarregar registro?' : `Excluir ${resource.singular}?`}
      >
        <p>
          {confirmation === 'reload'
            ? 'A versão atual do servidor substituirá os campos desta tela. Copie o texto que deseja preservar antes de continuar.'
            : 'Esta ação remove o registro. Vínculos em uso impedem a exclusão.'}
        </p>
        <div className="cms-actions">
          <Button onClick={() => void confirm()}>
            {confirmation === 'reload' ? 'Recarregar' : 'Confirmar exclusão'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmation(null)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
