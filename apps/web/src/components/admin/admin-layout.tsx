'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Avatar, Button, Drawer } from '@filaretti/ui';

export interface AdminNavigationItem {
  label: string;
  href: string;
  current?: boolean;
  icon?: ReactNode;
}

export interface AdminLayoutProps {
  brand: string;
  title: string;
  description?: string;
  navigation: AdminNavigationItem[];
  userLabel?: string;
  environmentLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function AdminNavigation({
  navigation,
  onNavigate,
}: {
  navigation: AdminNavigationItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="admin-navigation" aria-label="Navegação da administração">
      <ul>
        {navigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              onClick={onNavigate}
            >
              {item.icon ? (
                <span className="admin-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : (
                <span className="admin-nav-mark" aria-hidden="true" />
              )}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminLayout({
  brand,
  title,
  description,
  navigation,
  userLabel,
  environmentLabel = 'Ambiente local de testes',
  actions,
  children,
}: AdminLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Menu da administração" data-f-surface="dark">
        <p className="admin-brand">
          {brand}
          <span>Administração</span>
        </p>
        <p className="admin-nav-heading">Navegação</p>
        <AdminNavigation navigation={navigation} />
        <p className="admin-sidebar-note">{environmentLabel}</p>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <Button
            variant="ghost"
            className="admin-mobile-trigger"
            aria-label="Abrir navegação da administração"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          <p className="admin-topbar-context">
            {brand} <span>/ Administração</span>
          </p>
          {userLabel ? (
            <div className="admin-user">
              <span>{userLabel}</span>
              <Avatar name={userLabel} size="sm" />
            </div>
          ) : null}
          {actions}
        </header>
        <main id="conteudo" tabIndex={-1} className="admin-main">
          <div className="admin-page-heading">
            <p className="site-eyebrow">Administração</p>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {children}
        </main>
      </div>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Navegação da administração"
        side="left"
        className="admin-mobile-drawer"
      >
        <p className="admin-mobile-brand">{brand}</p>
        <AdminNavigation navigation={navigation} onNavigate={() => setMenuOpen(false)} />
        <p className="admin-mobile-note">{environmentLabel}</p>
      </Drawer>
    </div>
  );
}
