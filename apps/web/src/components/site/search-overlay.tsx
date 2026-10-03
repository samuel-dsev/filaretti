'use client';

import { useId, useRef, useState } from 'react';
import { Dialog, EmptyState, Input } from '@filaretti/ui';

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
      <div className="site-search-field">
        <label htmlFor={fieldId}>O que você procura?</label>
        <Input
          ref={inputRef}
          id={fieldId}
          type="search"
          autoComplete="off"
          placeholder="Digite uma palavra ou assunto"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-describedby={`${fieldId}-status`}
        />
      </div>
      <div id={`${fieldId}-status`} className="site-search-status" role="status">
        <EmptyState
          title={query.trim() ? 'A busca ainda está em preparação' : 'Comece por uma palavra'}
          description="Esta demonstração apresenta a interface de busca. A consulta a conteúdos estará disponível em uma próxima etapa."
        />
      </div>
    </Dialog>
  );
}
