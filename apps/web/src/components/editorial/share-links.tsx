'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Input } from '@filaretti/ui';

export function ShareLinks({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const manualLinkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manualCopy) {
      manualLinkRef.current?.focus();
      manualLinkRef.current?.select();
    }
  }, [manualCopy]);

  async function copyLink() {
    setCopying(true);
    setStatus('');
    setManualCopy(false);
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado.');
    } catch {
      setStatus('Não foi possível copiar automaticamente. Selecione e copie o endereço abaixo.');
      setManualCopy(true);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="editorial-share">
      <div className="editorial-share-links">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp <span className="f-sr-only">(abre em nova aba)</span>
          <span aria-hidden="true">↗</span>
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn <span className="f-sr-only">(abre em nova aba)</span>
          <span aria-hidden="true">↗</span>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}>
          E-mail <span aria-hidden="true">↗</span>
        </a>
        <Button
          variant="secondary"
          size="sm"
          onClick={copyLink}
          loading={copying}
          aria-describedby="compartilhar-status"
        >
          Copiar link
        </Button>
      </div>
      <p
        id="compartilhar-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="editorial-copy-status"
      >
        {status}
      </p>
      {manualCopy ? (
        <FormField
          id="endereco-publicacao"
          label="Endereço desta publicação"
          className="editorial-share-fallback"
        >
          {(props) => (
            <Input
              {...props}
              ref={manualLinkRef}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </FormField>
      ) : null}
    </div>
  );
}
