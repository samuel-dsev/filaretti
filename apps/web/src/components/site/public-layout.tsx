import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import type { PublicLayoutProps } from './types';

export function PublicLayout({ header, footer, children }: PublicLayoutProps) {
  return (
    <div className="site-layout">
      <SiteHeader {...header} />
      <main id="conteudo" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter {...footer} />
    </div>
  );
}
