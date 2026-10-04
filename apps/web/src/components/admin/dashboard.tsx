'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaginatedResponse } from '@filaretti/types';
import { Button, ErrorState, LinkButton, Skeleton } from '@filaretti/ui';
import { adminApi } from '@/lib/admin-api';
import { statusLabels, type AdminEntity } from '@/lib/admin-types';
import { useAdminSession } from './session';
import { TextField } from './form-controls';

export function Dashboard() {
  const { user, setUser } = useAdminSession();
  const router = useRouter();
  const [counts, setCounts] = useState<{ label: string; count: number; href: string }[]>();
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const role = user?.role;
  const load = useCallback(() => {
    const states =
      role === 'AUTHOR'
        ? (['DRAFT'] as const)
        : (['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const);
    return Promise.all(
      states.map(async (status) => {
        const data = await adminApi<PaginatedResponse<AdminEntity>>(
          `admin/articles?status=${status}&limit=1`,
        );
        return {
          label: statusLabels[status],
          count: data.meta.total,
          href: `/admin/artigos?status=${status}`,
        };
      }),
    )
      .then((result) => {
        setCounts(result);
        setError('');
      })
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error ? failure.message : 'Não foi possível carregar o dashboard.',
        );
      });
  }, [role]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      {error ? (
        <ErrorState
          title="Dashboard indisponível"
          description={error}
          action={<Button onClick={() => void load()}>Tentar novamente</Button>}
        />
      ) : counts ? (
        <div className="cms-metrics">
          {counts.map((item) => (
            <a href={item.href} className="cms-panel cms-metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
              <span>Ver artigos →</span>
            </a>
          ))}
        </div>
      ) : (
        <Skeleton label="Carregando indicadores" height="8rem" />
      )}
      <section className="cms-panel">
        <h2>Seu próximo conteúdo</h2>
        <p>Crie um rascunho, selecione a mídia e revise no preview antes da publicação.</p>
        <div className="cms-actions">
          <LinkButton href="/admin/artigos/novo">Novo artigo</LinkButton>
          <LinkButton href="/admin/midia" variant="secondary">
            Biblioteca de mídia
          </LinkButton>
        </div>
      </section>
      <section className="cms-panel">
        <h2>Segurança da conta</h2>
        <p>Ao trocar a senha, todas as sessões desta conta serão encerradas.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setPasswordError('');
            try {
              await adminApi('auth/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
              });
              setUser(null);
              router.replace('/admin/login');
            } catch (failure) {
              setPasswordError(
                failure instanceof Error ? failure.message : 'Não foi possível trocar a senha.',
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="cms-grid">
            <TextField
              label="Senha atual"
              type="password"
              value={currentPassword}
              required
              onChange={setCurrentPassword}
            />
            <TextField
              label="Nova senha"
              type="password"
              value={newPassword}
              required
              maxLength={128}
              help="Use entre 12 e 128 caracteres."
              onChange={setNewPassword}
            />
          </div>
          {passwordError ? (
            <p role="alert" className="cms-error">
              {passwordError}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={pending || newPassword.length < 12}>
            {pending ? 'Trocando senha…' : 'Trocar senha'}
          </Button>
        </form>
      </section>
    </>
  );
}
