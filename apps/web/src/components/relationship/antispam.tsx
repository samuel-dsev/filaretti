'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@filaretti/ui';
import { documentNonce } from '@/lib/security-policy';

export interface RelationshipConfiguration {
  mock: boolean;
  siteKey?: string;
}
interface Turnstile {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      theme: string;
    },
  ) => string;
  remove: (id: string) => void;
}
type TurnstileWindow = Window & { turnstile?: Turnstile };
let scriptRequest: Promise<void> | undefined;
const subscribeToHostname = () => () => undefined;

function loadWidget() {
  scriptRequest ??= new Promise<void>((resolve, reject) => {
    if ((window as TurnstileWindow).turnstile) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      scriptRequest = undefined;
      reject(new Error('unavailable'));
    };
    const timeout = window.setTimeout(fail, 10000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.nonce = documentNonce() ?? '';
    script.async = true;
    script.onload = () => {
      if (!(window as TurnstileWindow).turnstile) {
        fail();
        return;
      }
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return scriptRequest;
}

export function Antispam({
  config,
  action,
  onToken,
}: {
  config: RelationshipConfiguration;
  action: 'contact' | 'newsletter';
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const mode = useSyncExternalStore(
    subscribeToHostname,
    () =>
      config.mock && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
        ? 'mock'
        : config.siteKey
          ? 'real'
          : 'unavailable',
    () => 'pending',
  );
  const displayedError =
    error ||
    (mode === 'unavailable'
      ? 'A verificação de segurança está indisponível. Tente novamente mais tarde.'
      : '');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    onToken('');
    if (mode === 'mock') {
      onToken(`local-development-${action}`);
      return;
    }
    if (mode !== 'real' || !config.siteKey) return;
    void loadWidget()
      .then(() => {
        const turnstile = (window as TurnstileWindow).turnstile;
        if (!active || !turnstile || !container.current) return;
        widget = turnstile.render(container.current, {
          sitekey: config.siteKey!,
          action,
          theme: 'light',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setError('A verificação falhou. Tente novamente.');
          },
        });
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a verificação. Tente novamente.');
      });
    return () => {
      active = false;
      if (widget) (window as TurnstileWindow).turnstile?.remove(widget);
    };
  }, [action, mode, config.siteKey, onToken, attempt]);
  return (
    <div className="relationship-antispam">
      <div ref={container} />
      {mode === 'mock' ? (
        <p className="relationship-note">Verificação antispam simulada neste ambiente local.</p>
      ) : (
        <p className="relationship-note">Verificação de segurança necessária para enviar.</p>
      )}
      {displayedError ? (
        <>
          <p role="alert" className="relationship-error">
            {displayedError}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setError('');
              setAttempt(attempt + 1);
            }}
          >
            Tentar verificação novamente
          </Button>
        </>
      ) : null}
    </div>
  );
}
