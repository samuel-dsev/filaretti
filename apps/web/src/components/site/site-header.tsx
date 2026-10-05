'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Drawer } from '@filaretti/ui';
import { Brand } from './brand';
import { ArrowIcon, MenuIcon, SearchIcon } from './icons';
import { SearchOverlay } from './search-overlay';
import type { SiteHeaderProps, SiteNavigationItem } from './types';

export function SiteHeader({ brand, navigation, searchLabel = 'Buscar' }: SiteHeaderProps) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const id = useId();
  const activeItem = navigation.find((item) => item.id === activeMenu);
  const currentItem = navigation.find((item) => {
    const matchesPath = (href: string) =>
      pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
    return (
      (item.href && matchesPath(item.href)) || item.children?.some((link) => matchesPath(link.href))
    );
  });

  function currentLocation(item: SiteNavigationItem) {
    if (item.id !== currentItem?.id) return undefined;
    return pathname === item.href ? 'page' : 'location';
  }

  useEffect(() => {
    if (!activeMenu) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setActiveMenu(null);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [activeMenu]);

  function openWithKeyboard(item: SiteNavigationItem) {
    setActiveMenu(item.id);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus());
  }

  return (
    <>
      <header
        className="site-header"
        ref={headerRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && activeMenu) {
            event.preventDefault();
            buttonRefs.current.get(activeMenu)?.focus();
            setActiveMenu(null);
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setActiveMenu(null);
        }}
      >
        <div className="f-container site-header-inner">
          <Brand brand={brand} />
          <nav className="site-desktop-nav" aria-label="Navegação principal">
            <ul>
              {navigation.map((item) => (
                <li key={item.id}>
                  {item.children?.length ? (
                    <Button
                      variant="ghost"
                      className="site-nav-toggle"
                      aria-current={currentLocation(item)}
                      aria-expanded={activeMenu === item.id}
                      aria-controls={`${id}-${item.id}`}
                      ref={(element) => {
                        if (element) buttonRefs.current.set(item.id, element);
                        else buttonRefs.current.delete(item.id);
                      }}
                      onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          openWithKeyboard(item);
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  ) : item.href ? (
                    <Link
                      prefetch={false}
                      href={item.href}
                      className="site-nav-link"
                      aria-current={currentLocation(item)}
                      onClick={() => setActiveMenu(null)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="site-nav-label">{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header-actions">
            <Button
              variant="ghost"
              className="site-search-trigger"
              onClick={() => {
                setActiveMenu(null);
                setSearchOpen(true);
              }}
              aria-label={searchLabel}
            >
              <SearchIcon />
              <span>{searchLabel}</span>
            </Button>
            <Button
              variant="ghost"
              className="site-mobile-trigger"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileOpen}
              onClick={() => {
                setActiveMenu(null);
                setMobileOpen(true);
              }}
            >
              <MenuIcon />
            </Button>
          </div>
        </div>
        {activeItem?.children?.length ? (
          <div className="site-mega-menu" id={`${id}-${activeItem.id}`} ref={panelRef}>
            <div className="f-container site-mega-inner">
              <div className="site-mega-intro">
                <p className="site-eyebrow">Explore</p>
                <h2>{activeItem.label}</h2>
                {activeItem.description ? <p>{activeItem.description}</p> : null}
              </div>
              <ul className="site-mega-links">
                {activeItem.children.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link
                      prefetch={false}
                      href={link.href}
                      aria-current={pathname === link.href ? 'page' : undefined}
                      onClick={() => setActiveMenu(null)}
                    >
                      <span>
                        <strong>{link.label}</strong>
                        {link.description ? <small>{link.description}</small> : null}
                      </span>
                      <ArrowIcon diagonal />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </header>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Menu de navegação"
        side="right"
      >
        <nav className="site-mobile-nav" aria-label="Navegação principal no celular">
          <ul>
            {navigation.map((item) => (
              <li key={item.id}>
                {item.children?.length ? (
                  <>
                    <span className="site-mobile-group" aria-current={currentLocation(item)}>
                      {item.label}
                    </span>
                    <ul>
                      {item.children.map((link) => (
                        <li key={`${link.label}-${link.href}`}>
                          <Link
                            prefetch={false}
                            href={link.href}
                            aria-current={pathname === link.href ? 'page' : undefined}
                            onClick={() => setMobileOpen(false)}
                          >
                            {link.label}
                            <ArrowIcon />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : item.href ? (
                  <Link
                    prefetch={false}
                    href={item.href}
                    aria-current={currentLocation(item)}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                    <ArrowIcon />
                  </Link>
                ) : (
                  <span className="site-mobile-group">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
      {searchOpen ? <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}
