import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { isLocalDemoAllowed } from '../../../lib/local-demo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Filaretti — demonstração do Design System',
  robots: { index: false, follow: false },
};

export default async function DemoLayout({ children }: { children: ReactNode }) {
  // The showcase is isolated from public templates and never statically cached.
  // APP_ENV is the data environment; local optimized builds use NODE_ENV=production.
  const host = (await headers()).get('host') ?? '';
  if (!isLocalDemoAllowed(process.env.APP_ENV, host)) {
    notFound();
  }
  return children;
}
