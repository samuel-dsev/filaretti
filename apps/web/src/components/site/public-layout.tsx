import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import type { PublicLayoutProps } from './types';
import { ConsentProvider } from '../privacy/consent-provider';
import { validateWebEnvironment } from '@filaretti/config';

export function PublicLayout({ header, footer, children }: PublicLayoutProps) {
  const environment = validateWebEnvironment(process.env);
  return (
    <ConsentProvider
      environment={environment.appEnvironment}
      enabled={environment.analyticsEnabled}
      identifier={environment.analyticsId}
    >
      <div className="site-layout">
        <SiteHeader {...header} />
        <main id="conteudo" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter {...footer} />
      </div>
    </ConsentProvider>
  );
}
