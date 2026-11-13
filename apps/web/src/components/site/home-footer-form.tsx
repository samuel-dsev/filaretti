'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export function HomeFooterForm({ children }: { children: ReactNode }) {
  if (usePathname() !== '/') return null;
  return (
    <section
      className="site-footer-inquiry"
      id="conte-seu-caso"
      aria-labelledby="footer-case-heading"
    >
      <div>
        <h2 id="footer-case-heading">Conte seu caso</h2>
        <p>Compartilhe o que aconteceu e o que você precisa resolver.</p>
      </div>
      {children}
    </section>
  );
}
