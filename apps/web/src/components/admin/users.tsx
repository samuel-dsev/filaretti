'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AdministrativeUser, PaginatedResponse } from '@filaretti/types';
import { Badge, Button, Dialog, EmptyState, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi } from '@/lib/admin-api';
import { ChoiceField, TextField } from './form-controls';
import { useAdminSession } from './session';

export function Users() {
  const { user } = useAdminSession();
  const [data, setData] = useState<PaginatedResponse<AdministrativeUser>>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<AdministrativeUser>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('AUTHOR');
  const load = useCallback(
    () =>
      adminApi<PaginatedResponse<AdministrativeUser>>(`admin/users?page=${page}&limit=12`)
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar os usuários.',
          );
        }),
    [page],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      await adminApi('admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      setName('');
      setEmail('');
      setPassword('');
      setMessage('Usuário criado.');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível criar o usuário.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="cms-panel">
        <h2>Criar usuário</h2>
        <p>
          Administradores mantêm contas e configurações. Editores publicam. Autores trabalham nos
          próprios rascunhos.
        </p>
        <form onSubmit={create} aria-busy={pending}>
          <div className="cms-grid">
            <TextField
              label="Nome do usuário"
              value={name}
              required
              maxLength={120}
              onChange={setName}
            />
            <TextField
              label="E-mail do usuário"
              value={email}
              type="email"
              required
              maxLength={254}
              onChange={setEmail}
            />
            <TextField
              label="Senha inicial"
              value={password}
              type="password"
              required
              maxLength={128}
              help="Entre 12 e 128 caracteres. Entregue a senha por um canal seguro."
              onChange={setPassword}
            />
            <ChoiceField
              label="Perfil de acesso"
              value={role}
              required
              options={[
                { id: 'ADMIN', name: 'Administrador' },
                { id: 'EDITOR', name: 'Editor' },
                { id: 'AUTHOR', name: 'Autor' },
              ]}
              onChange={setRole}
            />
          </div>
          <Button type="submit" disabled={pending || password.length < 12}>
            {pending ? 'Criando…' : 'Criar usuário'}
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
        error ? (
          <ErrorState
            title="Usuários indisponíveis"
            action={<Button onClick={() => void load()}>Tentar novamente</Button>}
          />
        ) : (
          <Skeleton label="Carregando usuários" height="14rem" />
        )
      ) : data.data.length ? (
        <>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <caption className="f-sr-only">Contas administrativas</caption>
              <thead>
                <tr>
                  <th scope="col">Usuário</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((record) => (
                  <tr key={record.id}>
                    <th scope="row">
                      {record.name}
                      <span className="cms-table-sub">{record.email}</span>
                    </th>
                    <td>
                      {record.role === 'ADMIN'
                        ? 'Administrador'
                        : record.role === 'EDITOR'
                          ? 'Editor'
                          : 'Autor'}
                    </td>
                    <td>
                      <Badge variant={record.isActive ? 'success' : 'neutral'}>
                        {record.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!record.isActive || record.id === user?.id}
                        onClick={() => setSelected(record)}
                      >
                        Desativar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <EmptyState title="Nenhuma conta encontrada" />
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title="Desativar usuário?"
      >
        <p>A conta de {selected?.name} perderá acesso e todas as sessões serão encerradas.</p>
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
                await adminApi(`admin/users/${selected.id}/deactivate`, { method: 'POST' });
                setSelected(undefined);
                setMessage('Usuário desativado.');
                await load();
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : 'Não foi possível desativar.',
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Confirmar desativação
          </Button>
          <Button variant="secondary" onClick={() => setSelected(undefined)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
