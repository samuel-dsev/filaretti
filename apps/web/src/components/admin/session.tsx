'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AdministrativeUser } from '@filaretti/types';
import { Button, ErrorState, Skeleton } from '@filaretti/ui';
import { adminApi, AdminApiError, logout, obtainCsrf, refreshSession } from '@/lib/admin-api';
import { resources } from '@/lib/admin-types';
import { AdminLayout } from './admin-layout';

interface Session {
  user: AdministrativeUser | null;
  loading: boolean;
  error: string;
  setUser: (user: AdministrativeUser | null) => void;
  reload: () => Promise<void>;
}
const SessionContext = createContext<Session | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdministrativeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(
    () =>
      obtainCsrf()
        .then(async () => {
          let current: AdministrativeUser;
          try {
            current = await adminApi<AdministrativeUser>('auth/me', {}, false);
          } catch (failure) {
            if (!(failure instanceof AdminApiError) || failure.status !== 401) throw failure;
            current = (await refreshSession()).user;
          }
          return current;
        })
        .then((current) => {
          setUser(current);
          setError('');
        })
        .catch((failure: unknown) => {
          setUser(null);
          setError(
            failure instanceof AdminApiError && failure.status === 401
              ? ''
              : failure instanceof Error
                ? failure.message
                : 'Serviço indisponível.',
          );
        })
        .finally(() => {
          setLoading(false);
        }),
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <SessionContext.Provider value={{ user, loading, error, setUser, reload }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useAdminSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('Admin session provider required');
  return context;
}

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const { user, loading, error, setUser, reload } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState('');
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!loading && !user && !error) router.replace('/admin/login');
  }, [loading, user, error, router]);
  if (loading || (!user && !error))
    return (
      <main id="conteudo" tabIndex={-1} className="cms-session">
        <Skeleton label="Verificando sessão administrativa" height="8rem" />
      </main>
    );
  if (error)
    return (
      <main id="conteudo" tabIndex={-1} className="cms-session">
        <ErrorState
          headingLevel={1}
          title="Administração indisponível"
          description={error}
          action={<Button onClick={() => void reload()}>Tentar novamente</Button>}
        />
      </main>
    );
  if (!user) return null;
  const section = pathname.split('/')[2] ?? '';
  const navigation = [
    { label: 'Dashboard', href: '/admin' },
    ...Object.entries(resources)
      .filter(
        ([key]) =>
          user.role === 'ADMIN' ||
          (key !== 'redirects' && (user.role !== 'AUTHOR' || key === 'artigos')),
      )
      .map(([key, resource]) => ({ label: resource.label, href: `/admin/${key}` })),
    { label: 'Biblioteca de mídia', href: '/admin/midia' },
    ...(user.role === 'ADMIN'
      ? [
          { label: 'Usuários', href: '/admin/usuarios' },
          { label: 'Contatos', href: '/admin/contatos' },
          { label: 'Assinantes', href: '/admin/assinantes' },
          { label: 'Configurações', href: '/admin/configuracoes' },
        ]
      : []),
  ].map((entry) => ({
    ...entry,
    current: entry.href === '/admin' ? pathname === '/admin' : pathname.startsWith(entry.href),
  }));
  const title = navigation.find((item) => item.current)?.label ?? 'Administração';
  return (
    <AdminLayout
      brand="Filaretti"
      title={title}
      description={
        section
          ? 'Gerencie o conteúdo que será exibido no site.'
          : `Bem-vindo, ${user.name}. Acompanhe suas publicações e mantenha o conteúdo atualizado.`
      }
      navigation={navigation}
      userLabel={user.name}
      environmentLabel="CMS editorial"
      actions={
        <Button
          variant="ghost"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            try {
              await logout();
              setUser(null);
              router.replace('/admin/login');
            } catch (failure) {
              setLogoutError(
                failure instanceof Error ? failure.message : 'Não foi possível encerrar a sessão.',
              );
            } finally {
              setLeaving(false);
            }
          }}
        >
          {leaving ? 'Saindo…' : 'Sair'}
        </Button>
      }
    >
      <p className="cms-role">
        Acesso:{' '}
        {user.role === 'ADMIN' ? 'Administrador' : user.role === 'EDITOR' ? 'Editor' : 'Autor'}{' '}
        <Link href="/" prefetch={false} target="_blank" rel="noopener noreferrer">
          Abrir site ↗
        </Link>
      </p>
      {logoutError ? (
        <p role="alert" className="cms-error">
          {logoutError}
        </p>
      ) : null}
      {children}
    </AdminLayout>
  );
}
