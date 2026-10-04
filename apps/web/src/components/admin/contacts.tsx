'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  AdminContact,
  AdminContactsResponse,
  ContactDownloadIssued,
  ContactState,
} from '@filaretti/types';
import { Badge, Button, Dialog, EmptyState, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi } from '@/lib/admin-api';
import { privateDownloadPath } from '@/lib/relationship-routing';
import { privateDownload } from '../relationship/private-download';
import { ChoiceField, TextField } from './form-controls';
import '../relationship/styles.css';

const labels: Record<ContactState, string> = {
  NEW: 'Novo',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvido',
  ARCHIVED: 'Arquivado',
};
const options = Object.entries(labels).map(([id, name]) => ({ id, name }));
const scanLabels = {
  QUARANTINED: 'Em quarentena',
  LOCAL_VERIFIED: 'Verificado localmente',
  VERIFIED: 'Verificado',
  REJECTED: 'Rejeitado',
};
const date = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function Contacts({ initialPage = 1 }: { initialPage?: number }) {
  const [data, setData] = useState<AdminContactsResponse>();
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminContact>();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [deletion, setDeletion] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(
    () =>
      adminApi<AdminContactsResponse>(
        `admin/contacts?${new URLSearchParams({ page: String(page), limit: '12', ...(status ? { status } : {}), ...(search ? { q: search } : {}) })}`,
      )
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Não foi possível carregar as solicitações.',
          );
        })
        .finally(() => {
          setLoading(false);
        }),
    [page, search, status],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function open(record: AdminContact) {
    setPending(true);
    setError('');
    try {
      const detail = await adminApi<AdminContact>(`admin/contacts/${record.id}`);
      setSelected(detail);
      setSelectedStatus(detail.status);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível abrir.');
    } finally {
      setPending(false);
    }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError('');
    try {
      const updated = await adminApi<AdminContact>(`admin/contacts/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: selectedStatus, version: selected.version }),
      });
      setSelected(updated);
      setSelectedStatus(updated.status);
      setMessage('Status atualizado.');
      setLoading(true);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="cms-panel">
        <h2>Solicitações recebidas</h2>
        <p>Contatos e anexos privados, restritos a administradores.</p>
        <form
          className="cms-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setPage(1);
            setSearch(query);
            if (page === 1 && search === query) void load();
          }}
        >
          <ChoiceField
            label="Filtrar status de contato"
            value={status}
            options={options}
            onChange={(value) => {
              setLoading(true);
              setStatus(value);
              setPage(1);
            }}
          />
          <TextField
            label="Buscar por nome, e-mail ou assunto"
            value={query}
            maxLength={120}
            onChange={setQuery}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Buscar contatos
          </Button>
        </form>
      </section>
      {error ? (
        <p role="alert" className="cms-error">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!data ? (
        loading ? (
          <Skeleton label="Carregando contatos" height="14rem" />
        ) : (
          <ErrorState
            title="Contatos indisponíveis"
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Tentar novamente
              </Button>
            }
          />
        )
      ) : (
        <div aria-busy={loading}>
          {data.data.length ? (
            <>
              <div className="cms-table-wrap">
                <table className="cms-table">
                  <caption className="f-sr-only">Solicitações de contato</caption>
                  <thead>
                    <tr>
                      <th scope="col">Solicitação</th>
                      <th scope="col">Status</th>
                      <th scope="col">Recebida</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((record) => (
                      <tr key={record.id}>
                        <th scope="row">
                          {record.subject}
                          <span className="cms-table-sub">
                            {record.name} · {record.email}
                          </span>
                        </th>
                        <td>
                          <Badge>{labels[record.status]}</Badge>
                        </td>
                        <td>{date(record.createdAt)}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => void open(record)}
                          >
                            Ver solicitação
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cms-actions cms-pagination">
                <Button
                  variant="secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setLoading(true);
                    setPage(page - 1);
                  }}
                >
                  Anterior
                </Button>
                <span>
                  Página {data.meta.page} de {data.meta.pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= data.meta.pages || loading}
                  onClick={() => {
                    setLoading(true);
                    setPage(page + 1);
                  }}
                >
                  Próxima
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhuma solicitação encontrada"
              description="Novos contatos serão apresentados aqui."
            />
          )}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!pending) {
            setSelected(undefined);
            setDeletion(false);
          }
        }}
        title={selected?.subject ?? 'Solicitação de contato'}
        className="relationship-contact-dialog"
      >
        {selected ? (
          <>
            <dl className="relationship-channel">
              <div>
                <dt>Contato</dt>
                <dd>
                  {selected.name} · {selected.email}
                </dd>
              </div>
              {selected.phone ? (
                <div>
                  <dt>Telefone</dt>
                  <dd>{selected.phone}</dd>
                </div>
              ) : null}
              {selected.state ? (
                <div>
                  <dt>Estado</dt>
                  <dd>{selected.state}</dd>
                </div>
              ) : null}
              <div>
                <dt>Recebida</dt>
                <dd>{date(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Ciência de privacidade</dt>
                <dd>
                  {selected.privacyVersion} · {date(selected.consentedAt)}
                </dd>
              </div>
            </dl>
            <h3>Mensagem</h3>
            <p className="relationship-contact-copy">{selected.message}</p>
            <h3>Anexos</h3>
            {selected.attachments.length ? (
              <ul>
                {selected.attachments.map((file) => (
                  <li key={file.id}>
                    <p>
                      {file.filename} · {(file.size / 1024).toFixed(0)} KiB ·{' '}
                      {scanLabels[file.scanStatus]}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={
                        pending || !['VERIFIED', 'LOCAL_VERIFIED'].includes(file.scanStatus)
                      }
                      onClick={async () => {
                        setPending(true);
                        setError('');
                        try {
                          const ticket = await adminApi<ContactDownloadIssued>(
                            `admin/contacts/${selected.id}/attachments/${file.id}/download-ticket`,
                            { method: 'POST', body: '{}' },
                          );
                          const path = privateDownloadPath(ticket.url);
                          if (!path) throw new Error('Download indisponível.');
                          await privateDownload(path, file.filename);
                        } catch (failure) {
                          setError(
                            failure instanceof Error ? failure.message : 'Não foi possível baixar.',
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Baixar anexo privado
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum anexo.</p>
            )}
            <form onSubmit={update} className="relationship-status">
              <ChoiceField
                label="Status da solicitação"
                value={selectedStatus}
                options={options}
                required
                onChange={setSelectedStatus}
              />
              <Button type="submit" disabled={pending || selectedStatus === selected.status}>
                Salvar status
              </Button>
            </form>
            {error ? (
              <p role="alert" className="cms-error">
                {error}
              </p>
            ) : null}
            {deletion ? (
              <>
                <p>
                  A exclusão remove a solicitação e seus anexos. Esta ação não pode ser desfeita.
                </p>
                <div className="cms-actions">
                  <Button
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      setError('');
                      try {
                        await adminApi(`admin/contacts/${selected.id}`, {
                          method: 'DELETE',
                          body: JSON.stringify({ version: selected.version }),
                        });
                        setSelected(undefined);
                        setDeletion(false);
                        setMessage('Solicitação excluída.');
                        await load();
                      } catch (failure) {
                        setError(
                          failure instanceof Error ? failure.message : 'Não foi possível excluir.',
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Confirmar exclusão
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => setDeletion(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" disabled={pending} onClick={() => setDeletion(true)}>
                Excluir solicitação
              </Button>
            )}
            <Button variant="ghost" disabled={pending} onClick={() => void open(selected)}>
              Recarregar solicitação
            </Button>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
