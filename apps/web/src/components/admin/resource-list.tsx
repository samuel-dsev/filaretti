'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaginatedResponse } from '@filaretti/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Pagination,
  Skeleton,
} from '@filaretti/ui';
import { adminApi } from '@/lib/admin-api';
import { resources, statusLabels, type AdminEntity, type ResourceKey } from '@/lib/admin-types';
import { ChoiceField } from './form-controls';
import { useAdminSession } from './session';

export function ResourceList({
  kind,
  page,
  status,
  type,
}: {
  kind: ResourceKey;
  page: number;
  status: string;
  type: string;
}) {
  const router = useRouter();
  const { user } = useAdminSession();
  const [data, setData] = useState<PaginatedResponse<AdminEntity>>();
  const [error, setError] = useState('');
  const resource = resources[kind];
  const query = new URLSearchParams({ page: String(page), limit: '12' });
  if (kind === 'artigos' && status) query.set('status', status);
  if (kind === 'artigos' && type) query.set('type', type);
  const requestQuery = query.toString();
  const load = useCallback(
    () =>
      adminApi<PaginatedResponse<AdminEntity>>(`admin/${resource.endpoint}?${requestQuery}`)
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar a listagem.',
          );
        }),
    [resource.endpoint, requestQuery],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const href = (next: number, nextStatus = status, nextType = type) => {
    const params = new URLSearchParams({ pagina: String(next) });
    if (nextStatus) params.set('status', nextStatus);
    if (nextType) params.set('tipo', nextType);
    return `/admin/${kind}?${params}`;
  };
  return (
    <>
      <div className="cms-list-toolbar">
        <p>
          {data ? `${data.meta.total} registros` : 'Carregando…'}
          {user?.role === 'AUTHOR' ? ' · seus próprios rascunhos' : ''}
        </p>
        <LinkButton href={`/admin/${kind}/novo`}>Criar {resource.singular}</LinkButton>
      </div>
      {kind === 'artigos' ? (
        <div className="cms-panel cms-filters">
          {user?.role !== 'AUTHOR' ? (
            <ChoiceField
              label="Filtrar por estado"
              value={status}
              options={Object.entries(statusLabels).map(([id, name]) => ({ id, name }))}
              onChange={(value) => router.push(href(1, value))}
            />
          ) : null}
          <ChoiceField
            label="Filtrar por tipo"
            value={type}
            options={[
              { id: 'ARTICLE', name: 'Artigo' },
              { id: 'UPDATE', name: 'Atualização' },
              { id: 'GUIDE', name: 'Guia' },
            ]}
            onChange={(value) => router.push(href(1, status, value))}
          />
        </div>
      ) : null}
      {error ? (
        <ErrorState
          headingLevel={2}
          title="Listagem indisponível"
          description={error}
          action={<Button onClick={() => void load()}>Tentar novamente</Button>}
        />
      ) : !data ? (
        <Skeleton height="15rem" label="Carregando registros" />
      ) : data.data.length ? (
        <>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <caption className="f-sr-only">{resource.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Registro</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Versão</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((record) => (
                  <tr key={record.id}>
                    <th scope="row">
                      <a href={`/admin/${kind}/${record.id}`}>
                        {record.title || record.name || record.question || record.sourcePath}
                      </a>
                      <span className="cms-table-sub">{record.slug || record.targetPath}</span>
                    </th>
                    <td>
                      <Badge
                        variant={
                          record.status === 'PUBLISHED' || record.isActive ? 'success' : 'neutral'
                        }
                      >
                        {record.status
                          ? statusLabels[record.status]
                          : record.isActive
                            ? 'Ativo'
                            : 'Inativo'}
                      </Badge>
                    </td>
                    <td>{record.version}</td>
                    <td>
                      <a
                        href={`/admin/${kind}/${record.id}`}
                        aria-label={`Editar ${record.title || record.name || record.question || record.sourcePath}`}
                      >
                        Editar →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.pages}
            getHref={(next) => href(next)}
          />
        </>
      ) : (
        <EmptyState
          headingLevel={2}
          title="Nenhum registro encontrado"
          description="Crie um registro ou altere os filtros para começar."
        />
      )}
    </>
  );
}
