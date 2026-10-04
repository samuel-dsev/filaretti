import type { ReactNode } from 'react';
import { AdminWorkspace } from '@/components/admin/session';
export default function Layout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
