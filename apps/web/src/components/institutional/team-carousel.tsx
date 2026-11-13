'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { isManagedPublicMedia } from '@/lib/public-media';

interface Member {
  id: string;
  name: string;
  title: string;
  qualification?: string;
  href: string;
  image?: { src: string; alt: string };
}

const motionPreference = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(listener: () => void) {
  const media = window.matchMedia(motionPreference);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function TeamCarousel({ members }: { members: Member[] }) {
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(motionPreference).matches,
    () => true,
  );
  const multiple = members.length > 1;
  const index = members.length ? position % members.length : 0;
  const member = members[index];
  const rotating = multiple && !paused && !hovered && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(
      () => setPosition((current) => (current + 1) % members.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [members.length, rotating]);

  function move(offset: number) {
    setPaused(true);
    setPosition((current) => (current + offset + members.length) % members.length);
  }

  return (
    <section
      id="profissionais"
      className="home-team"
      data-f-surface="dark"
      aria-labelledby="home-team-heading"
      aria-roledescription={multiple ? 'carrossel' : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="f-container home-team-inner">
        <h2 id="home-team-heading">Nossa equipe</h2>
        {multiple ? (
          <div className="home-team-controls">
            {!reducedMotion ? (
              <button type="button" onClick={() => setPaused(!paused)}>
                {paused ? 'Retomar' : 'Pausar'}
              </button>
            ) : null}
            <button type="button" aria-label="Perfil anterior" onClick={() => move(-1)}>
              <span aria-hidden="true">←</span>
            </button>
            <span aria-hidden="true">
              {index + 1} / {members.length}
            </span>
            <button type="button" aria-label="Próximo perfil" onClick={() => move(1)}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
        <div
          className="home-team-slide"
          aria-live={rotating ? 'off' : 'polite'}
          onFocus={() => setPaused(true)}
        >
          {member ? (
            <div
              key={member.id}
              className="home-team-profile"
              role={multiple ? 'group' : undefined}
              aria-roledescription={multiple ? 'slide' : undefined}
              aria-label={multiple ? `${index + 1} de ${members.length}` : undefined}
            >
              {member.image ? (
                <div className="home-team-media">
                  <Image
                    src={member.image.src}
                    alt={member.image.alt}
                    fill
                    sizes="100vw"
                    unoptimized={isManagedPublicMedia(member.image.src)}
                  />
                </div>
              ) : null}
              <div className="home-team-copy">
                <h3>{member.name}</h3>
                <p className="home-team-title">{member.title}</p>
                {member.qualification ? <p>{member.qualification}</p> : null}
                <Link href={member.href} prefetch={false}>
                  Ver perfil <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="home-team-copy home-team-empty">
              <p>Os perfis da equipe serão apresentados aqui.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
