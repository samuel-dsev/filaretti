import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminSessionProvider } from '@/components/admin/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Administração | Filaretti',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
