'use client';

import { useId, type ReactNode } from 'react';

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  multiple?: boolean;
  className?: string;
}

export function Accordion({ items, multiple = false, className }: AccordionProps) {
  const groupName = useId();
  return (
    <div className={['f-accordion', className].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <details
          className="f-accordion__item"
          key={item.id}
          name={multiple ? undefined : groupName}
        >
          <summary className="f-accordion__summary">
            <span>{item.title}</span>
            <span className="f-accordion__indicator" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="f-accordion__content">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
