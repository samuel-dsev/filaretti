'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button, Dialog } from '@filaretti/ui';
import { documentNonce } from '@/lib/security-policy';
import {
  analyticsAllowed,
  analyticsEvents,
  consentStorageKey,
  parsePreferences,
  type AnalyticsEvent,
  type CookiePreferences,
} from '@/lib/consent';
import './styles.css';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}
const PreferencesContext = createContext<(() => void) | null>(null);
let analyticsActive = false;
let inVisitPreferences: string | null | undefined;
const preferenceListeners = new Set<() => void>();

function readPreferenceSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  if (inVisitPreferences !== undefined) return inVisitPreferences;
  try {
    return localStorage.getItem(consentStorageKey);
  } catch {
    return null;
  }
}
const serverPreferenceSnapshot = () => null;

/** No free-form event parameters are accepted, so content and identifiers cannot be included. */
export function trackAnalytics(event: AnalyticsEvent) {
  if (analyticsActive && analyticsEvents.includes(event)) window.gtag?.('event', event);
}

function revokeAnalytics(identifier: string) {
  analyticsActive = false;
  const browser = window;
  browser[`ga-disable-${identifier}`] = true;
  browser.gtag = () => undefined;
  browser.dataLayer = [];
  document.querySelectorAll('[data-filaretti-analytics]').forEach((script) => script.remove());
  const host = window.location.hostname;
  const domains = [
    '',
    host,
    ...host.split('.').map((_, index, parts) => `.${parts.slice(index).join('.')}`),
  ];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0] ?? '';
    if (!/^_ga(?:_|$)|^_gid$|^_gat/u.test(name)) continue;
    for (const domain of domains)
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
  }
}

export function ConsentProvider({
  children,
  environment,
  enabled,
  identifier,
}: {
  children: ReactNode;
  environment: string;
  enabled: boolean;
  identifier?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const subscribePreferences = useCallback(
    (listener: () => void) => {
      preferenceListeners.add(listener);
      function changedInAnotherTab(event: StorageEvent) {
        if (event.key !== consentStorageKey && event.key !== null) return;
        inVisitPreferences = event.newValue;
        const next = parsePreferences(event.newValue);
        if (!next?.analytics) revokeAnalytics(identifier ?? '');
        setAnalyticsChoice(next?.analytics ?? false);
        listener();
      }
      window.addEventListener('storage', changedInAnotherTab);
      return () => {
        preferenceListeners.delete(listener);
        window.removeEventListener('storage', changedInAnotherTab);
      };
    },
    [identifier],
  );
  const stored = useSyncExternalStore(
    subscribePreferences,
    readPreferenceSnapshot,
    serverPreferenceSnapshot,
  );
  const preferences = useMemo(() => parsePreferences(stored), [stored]);
  useEffect(() => {
    const id = identifier ?? '';
    if (!analyticsAllowed(environment, enabled, identifier, preferences, pathname)) {
      revokeAnalytics(id);
      return;
    }
    const browser = window;
    browser[`ga-disable-${id}`] = false;
    browser.dataLayer = [];
    browser.gtag = function () {
      // Google tag commands use the arguments object, matching the provider's bootstrap.
      // eslint-disable-next-line prefer-rest-params -- Preserve Google's documented IArguments command format.
      browser.dataLayer?.push(arguments);
    };
    browser.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    browser.gtag('js', new Date());
    browser.gtag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: `${window.location.origin}/`,
      page_referrer: '',
      page_title: 'Site institucional',
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    script.nonce = documentNonce() ?? '';
    script.dataset.filarettiAnalytics = 'true';
    document.head.append(script);
    analyticsActive = true;
    return () => revokeAnalytics(id);
  }, [environment, enabled, identifier, preferences, pathname]);
  useEffect(() => {
    function trackClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link) return;
      const declared = link.getAttribute('data-analytics-event');
      if (declared && analyticsEvents.includes(declared as AnalyticsEvent)) {
        trackAnalytics(declared as AnalyticsEvent);
        return;
      }
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      if (link.closest('.editorial-share-links')) trackAnalytics('article_share');
      else if (['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname))
        trackAnalytics('click_whatsapp');
      else if (url.pathname.endsWith('.pdf') && url.pathname.startsWith('/media/public/'))
        trackAnalytics('download_guide');
    }
    document.addEventListener('click', trackClick);
    function trackSubmit(event: SubmitEvent) {
      const form = event.target;
      const declared =
        form instanceof HTMLFormElement ? form.getAttribute('data-analytics-event') : null;
      if (declared && analyticsEvents.includes(declared as AnalyticsEvent))
        trackAnalytics(declared as AnalyticsEvent);
    }
    document.addEventListener('submit', trackSubmit);
    return () => {
      document.removeEventListener('click', trackClick);
      document.removeEventListener('submit', trackSubmit);
    };
  }, []);
  function save(analytics: boolean) {
    const next: CookiePreferences = { version: 1, necessary: true, analytics };
    if (!analytics) revokeAnalytics(identifier ?? '');
    inVisitPreferences = JSON.stringify(next);
    try {
      localStorage.setItem(consentStorageKey, inVisitPreferences);
    } catch {
      /* Preference applies to this visit even if saving is unavailable. */
    }
    for (const listener of preferenceListeners) listener();
    setAnalyticsChoice(analytics);
    setOpen(false);
  }
  return (
    <PreferencesContext.Provider
      value={() => {
        setAnalyticsChoice(preferences?.analytics ?? false);
        setOpen(true);
      }}
    >
      {children}
      {/* Show the consent request in the server HTML while browser preferences are unknown.
          Analytics still requires the verified browser preference and explicit production gates. */}
      {!preferences && !open ? (
        <aside className="privacy-banner" aria-label="Preferências de cookies">
          <div>
            <h2>Suas preferências de cookies</h2>
            <p>
              Usamos recursos necessários para o funcionamento do site. Analytics só inicia com sua
              autorização.{' '}
              <Link prefetch={false} href="/cookies">
                Conheça os cookies
              </Link>
              .
            </p>
          </div>
          <div className="privacy-actions">
            <Button variant="secondary" onClick={() => save(false)}>
              Somente necessários
            </Button>
            <Button onClick={() => save(true)}>Aceitar analytics</Button>
            <Button variant="ghost" onClick={() => setOpen(true)}>
              Escolher preferências
            </Button>
          </div>
        </aside>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} title="Preferências de cookies">
        <p>Você pode alterar sua escolha a qualquer momento pelo rodapé.</p>
        <label className="privacy-option">
          <input type="checkbox" checked disabled />
          <span>
            <strong>Necessários</strong>
            <small>Funcionamento do site, segurança e armazenamento desta escolha.</small>
          </span>
        </label>
        <label className="privacy-option">
          <input
            type="checkbox"
            checked={analyticsChoice}
            onChange={(event) => setAnalyticsChoice(event.target.checked)}
          />
          <span>
            <strong>Analytics</strong>
            <small>
              Medição de ações no site, sem mensagens, e-mails, documentos ou consultas de busca.
            </small>
          </span>
        </label>
        <div className="privacy-actions">
          <Button onClick={() => save(analyticsChoice)}>Salvar preferências</Button>
          <Button variant="secondary" onClick={() => save(false)}>
            Somente necessários
          </Button>
        </div>
        <p>
          <Link prefetch={false} href="/privacidade">
            Privacidade
          </Link>{' '}
          ·{' '}
          <Link prefetch={false} href="/cookies">
            Cookies
          </Link>
        </p>
      </Dialog>
    </PreferencesContext.Provider>
  );
}

export function CookiePreferencesButton() {
  const open = useContext(PreferencesContext);
  return open ? (
    <button type="button" className="privacy-footer-button" onClick={open}>
      Preferências de cookies
    </button>
  ) : null;
}
