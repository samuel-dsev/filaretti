import Link from 'next/link';
import { Brand } from './brand';
import type { SiteFooterProps } from './types';

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
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        {note ? <p className="site-footer-note">{note}</p> : null}
        <div className="site-footer-bottom">
          <p>{copyright}</p>
          <Link href="#conteudo">
            Voltar ao conteúdo <span aria-hidden="true">↑</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
