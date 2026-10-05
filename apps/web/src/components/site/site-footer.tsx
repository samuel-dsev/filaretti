import Link from 'next/link';
import { Brand } from './brand';
import type { SiteFooterProps } from './types';
import { CookiePreferencesButton } from '../privacy/consent-provider';

export function SiteFooter({ brand, description, groups, note, copyright }: SiteFooterProps) {
  return (
    <footer className="site-footer" data-f-surface="dark">
      <div className="f-container">
        <div className="site-footer-grid">
          <div className="site-footer-intro">
            <Brand brand={brand} inverse />
            <p>{description}</p>
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="site-footer-nav">
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link prefetch={false} href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        {note ? <p className="site-footer-note">{note}</p> : null}
        <nav className="privacy-footer-links" aria-label="Privacidade e preferências">
          <Link prefetch={false} href="/privacidade">
            Privacidade
          </Link>
          <Link prefetch={false} href="/cookies">
            Cookies
          </Link>
          <CookiePreferencesButton />
        </nav>
        <div className="site-footer-bottom">
          <p>{copyright}</p>
          <Link prefetch={false} href="#conteudo">
            Voltar ao conteúdo <span aria-hidden="true">↑</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
