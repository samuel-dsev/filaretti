'use client';

import { useId, useRef, useState } from 'react';
import { Button, Dialog, Input } from '@filaretti/ui';

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function SearchOverlay({ open, onClose, title = 'Buscar no site' }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Encontre conteúdos, áreas e profissionais."
      initialFocusRef={inputRef}
      className="site-search-dialog"
    >
      <form action="/busca" method="get" data-analytics-event="search">
        <div className="site-search-field">
          <label htmlFor={fieldId}>O que você procura?</label>
          <Input
            ref={inputRef}
            id={fieldId}
            type="search"
            name="q"
            minLength={2}
            maxLength={120}
            required
            autoComplete="off"
            placeholder="Digite uma palavra ou assunto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-describedby={`${fieldId}-status`}
          />
        </div>
        <p id={`${fieldId}-status`} className="site-search-status">
          Use ao menos duas letras para pesquisar conteúdos, áreas e profissionais publicados.
        </p>
        <Button type="submit">Ver resultados</Button>
      </form>
    </Dialog>
  );
}
