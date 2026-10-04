'use client';

import { EmptyState, ErrorState } from '@filaretti/ui';
import Link from 'next/link';
import { resources, type ResourceKey } from '@/lib/admin-types';
import { Dashboard } from './dashboard';
import { MediaLibrary } from './media-library';
import { ResourceEditor } from './resource-editor';
import { ResourceList } from './resource-list';
import { Settings } from './settings';
import { Users } from './users';
import { useAdminSession } from './session';
import { Contacts } from './contacts';
import { Subscribers } from './subscribers';

export function CmsPage({
  route,
  page,
  status,
  type,
}: {
  route: string[];
  page: number;
  status: string;
  type: string;
}) {
  const { user } = useAdminSession();
  if (!route.length) return <Dashboard />;
  const section = route[0]!;
  if (
    (['usuarios', 'configuracoes', 'redirects', 'contatos', 'assinantes'].includes(section) &&
      user?.role !== 'ADMIN') ||
    (user?.role === 'AUTHOR' && !['artigos', 'midia'].includes(section))
  )
    return (
      <ErrorState
        title="Acesso restrito"
        description="Seu perfil não tem permissão para gerenciar esta seção."
      />
    );
  if (route.length === 1 && section === 'midia') return <MediaLibrary />;
  if (route.length === 1 && section === 'usuarios') return <Users />;
  if (route.length === 1 && section === 'configuracoes') return <Settings />;
  if (route.length === 1 && section === 'contatos') return <Contacts initialPage={page} />;
  if (route.length === 1 && section === 'assinantes') return <Subscribers initialPage={page} />;
  if (!(section in resources) || route.length > 2)
    return (
      <EmptyState
        title="Página administrativa não encontrada"
        action={<Link href="/admin">Voltar ao dashboard</Link>}
      />
    );
  const kind = section as ResourceKey;
  return route.length === 1 ? (
    <ResourceList
      key={`${kind}:${page}:${status}:${type}`}
      kind={kind}
      page={page}
      status={status}
      type={type}
    />
  ) : (
    <ResourceEditor
      key={`${kind}:${route[1]}`}
      kind={kind}
      recordId={route[1] === 'novo' ? undefined : route[1]}
    />
  );
}
