'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@filaretti/ui';
import styles from './article-carousel.module.css';

export function ArticleCarouselTrack({ children, label }: { children: ReactNode; label: string }) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  useEffect(() => {
    const element = track.current;
    if (!element) return;

    function update() {
      if (!element) return;
      const atStart = element.scrollLeft <= 1;
      const atEnd = element.scrollWidth - element.clientWidth - element.scrollLeft <= 1;
      setEdges((previous) =>
        previous.atStart === atStart && previous.atEnd === atEnd ? previous : { atStart, atEnd },
      );
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [children]);

  function move(direction: -1 | 1) {
    const element = track.current;
    const first = element?.children[0];
    const second = element?.children[1];
    if (!element || !first || !second) return;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    element.scrollBy({ left: direction * step });
  }

  return (
    <div role="group" aria-roledescription="carrossel" aria-label={label}>
      <ul id={id} ref={track} className={styles.track}>
        {children}
      </ul>
      {!edges.atStart || !edges.atEnd ? (
        <div className={styles.controls}>
          <Button
            type="button"
            variant="secondary"
            className={styles.control}
            aria-controls={id}
            aria-label="Artigo anterior"
            aria-disabled={edges.atStart}
            onClick={() => {
              if (!edges.atStart) move(-1);
            }}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={styles.control}
            aria-controls={id}
            aria-label="Próximo artigo"
            aria-disabled={edges.atEnd}
            onClick={() => {
              if (!edges.atEnd) move(1);
            }}
          >
            <span aria-hidden="true">→</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
