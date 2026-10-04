'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminSubscriber, AdminSubscribersResponse, NewsletterState } from '@filaretti/types';
import { Badge, Button, Dialog, EmptyState, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi } from '@/lib/admin-api';
import { privateDownload } from '../relationship/private-download';
import { ChoiceField, TextField } from './form-controls';

const labels: Record<NewsletterState, string> = {
  PENDING: 'Aguardando confirmação',
  ACTIVE: 'Ativo',
  UNSUBSCRIBED: 'Descadastrado',
};
const options = Object.entries(labels).map(([id, name]) => ({ id, name }));
const date = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function Subscribers({ initialPage = 1 }: { initialPage?: number }) {
  const [data, setData] = useState<AdminSubscribersResponse>();
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminSubscriber>();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const filters = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(search ? { q: search } : {}),
  });
  const load = useCallback(
    () =>
      adminApi<AdminSubscribersResponse>(
        `admin/subscribers?${new URLSearchParams({ page: String(page), limit: '12', ...(status ? { status } : {}), ...(search ? { q: search } : {}) })}`,
      )
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar os assinantes.',
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
  return (
    <>
      <section className="cms-panel">
        <h2>Assinantes da newsletter</h2>
        <p>
          Apenas inscrições confirmadas ficam ativas. A V1 gerencia inscrições e mensagens
          transacionais.
        </p>
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
            label="Filtrar status de inscrição"
            value={status}
            options={options}
            onChange={(value) => {
              setLoading(true);
              setStatus(value);
              setPage(1);
            }}
          />
          <TextField
            label="Buscar por nome ou e-mail"
            value={query}
            maxLength={120}
            onChange={setQuery}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Buscar assinantes
          </Button>
        </form>
        <Button
          variant="secondary"
          disabled={pending || loading || !data?.data.length}
          onClick={async () => {
            setPending(true);
            setError('');
            try {
              await privateDownload(
                `/api/cms/admin/subscribers/export?${filters}`,
                'assinantes.csv',
              );
              setMessage('Exportação concluída.');
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Não foi possível exportar.');
            } finally {
              setPending(false);
            }
          }}
        >
          Exportar CSV
        </Button>
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
          <Skeleton label="Carregando assinantes" height="14rem" />
        ) : (
          <ErrorState
            title="Assinantes indisponíveis"
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
                  <caption className="f-sr-only">Inscrições na newsletter</caption>
                  <thead>
                    <tr>
                      <th scope="col">Assinante</th>
                      <th scope="col">Status</th>
                      <th scope="col">Consentimento</th>
                      <th scope="col">Confirmação</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((record) => (
                      <tr key={record.id}>
                        <th scope="row">
                          {record.name || 'Nome não informado'}
                          <span className="cms-table-sub">{record.email}</span>
                        </th>
                        <td>
                          <Badge variant={record.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {labels[record.status]}
                          </Badge>
                          {record.unsubscribedAt ? (
                            <span className="cms-table-sub">{date(record.unsubscribedAt)}</span>
                          ) : null}
                        </td>
                        <td>
                          {record.consentVersion}
                          <span className="cms-table-sub">{date(record.consentedAt)}</span>
                        </td>
                        <td>{record.confirmedAt ? date(record.confirmedAt) : 'Não confirmada'}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => setSelected(record)}
                          >
                            Excluir assinante
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
              title="Nenhum assinante encontrado"
              description="As inscrições recebidas serão apresentadas aqui."
            />
          )}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!pending) setSelected(undefined);
        }}
        title="Excluir assinante?"
      >
        <p>A exclusão remove os dados de {selected?.email}. Esta ação não pode ser desfeita.</p>
        {error ? (
          <p role="alert" className="cms-error">
            {error}
          </p>
        ) : null}
        <div className="cms-actions">
          <Button
            disabled={pending}
            onClick={async () => {
              if (!selected) return;
              setPending(true);
              setError('');
              try {
                await adminApi(`admin/subscribers/${selected.id}`, {
                  method: 'DELETE',
                  body: JSON.stringify({ version: selected.version }),
                });
                setSelected(undefined);
                setMessage('Assinante excluído.');
                await load();
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : 'Não foi possível excluir.');
              } finally {
                setPending(false);
              }
            }}
          >
            Confirmar exclusão
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setSelected(undefined)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
