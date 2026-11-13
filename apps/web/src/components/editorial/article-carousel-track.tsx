'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './article-carousel.module.css';

export function ArticleCarouselTrack({ children, label }: { children: ReactNode; label: string }) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const previousButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  useEffect(() => {
    const element = track.current;
    if (!element) return;

    const update = () => {
      const offset = element.scrollLeft;
      const atEnd = element.scrollWidth - element.clientWidth - offset <= 1;
      const firstWidth = element.firstElementChild?.getBoundingClientRect().width ?? 0;
      const atStart = offset <= 1 || (!atEnd && offset < firstWidth - 1);
      if (
        (atStart && document.activeElement === previousButton.current) ||
        (atEnd && document.activeElement === nextButton.current)
      ) {
        element.focus({ preventScroll: true });
      }
      setEdges((previous) =>
        previous.atStart === atStart && previous.atEnd === atEnd ? previous : { atStart, atEnd },
      );
    };

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
    <div
      className={styles.carousel}
      role="group"
      aria-roledescription="carrossel"
      aria-label={label}
    >
      <ul
        id={id}
        ref={track}
        className={styles.track}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
      >
        {children}
      </ul>
      {!edges.atStart ? (
        <button
          ref={previousButton}
          type="button"
          className={`${styles.control} ${styles.previous}`}
          aria-controls={id}
          aria-label="Artigo anterior"
          onClick={() => move(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
      ) : null}
      {!edges.atEnd ? (
        <button
          ref={nextButton}
          type="button"
          className={`${styles.control} ${styles.next}`}
          aria-controls={id}
          aria-label="Próximo artigo"
          onClick={() => move(1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
