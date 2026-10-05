import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AdminSessionProvider, AdminWorkspace } from '../src/components/admin/session';
import { adminApi, AdminApiError, obtainCsrf, refreshSession } from '../src/lib/admin-api';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => router,
}));
vi.mock('../src/components/admin/admin-layout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../src/lib/admin-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/admin-api')>()),
  adminApi: vi.fn(),
  obtainCsrf: vi.fn(),
  refreshSession: vi.fn(),
}));

test('retry after an outage clears the old service error and returns an expired session to login', async () => {
  vi.mocked(obtainCsrf).mockRejectedValueOnce(
    new AdminApiError('UNAVAILABLE', 503, 'Serviço temporariamente indisponível.'),
  );
  vi.mocked(obtainCsrf).mockResolvedValueOnce(undefined);
  vi.mocked(adminApi).mockRejectedValueOnce(
    new AdminApiError('UNAUTHORIZED', 401, 'Sua sessão expirou.'),
  );
  vi.mocked(refreshSession).mockRejectedValueOnce(
    new AdminApiError('UNAUTHORIZED', 401, 'Sua sessão expirou.'),
  );
  render(
    <AdminSessionProvider>
      <AdminWorkspace>Conteúdo administrativo</AdminWorkspace>
    </AdminSessionProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Administração indisponível' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin/login'));
  expect(screen.queryByRole('heading', { name: 'Administração indisponível' })).toBeNull();
  expect(screen.queryByText('Conteúdo administrativo')).toBeNull();
});
