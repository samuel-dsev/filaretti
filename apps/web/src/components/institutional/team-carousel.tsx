'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { isManagedPublicMedia } from '@/lib/public-media';

interface Member {
  id: string;
  name: string;
  title: string;
  href: string;
  image?: { src: string; alt: string };
  artwork?: string;
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

  if (!member) return null;

  const image = member.artwork ? { src: member.artwork, alt: '' } : member.image;
  return (
    <section
      id="profissionais"
      className="home-team"
      aria-label="Equipe"
      aria-roledescription={multiple ? 'carrossel' : undefined}
    >
      <div className="f-container home-team-inner">
        <div
          className="home-team-frame"
          data-f-surface="dark"
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setHovered(true);
          }}
          onPointerLeave={() => setHovered(false)}
        >
          <div className="home-team-slide" aria-live={rotating ? 'off' : 'polite'}>
            <div
              key={member.id}
              className="home-team-profile"
              role={multiple ? 'group' : undefined}
              aria-roledescription={multiple ? 'slide' : undefined}
              aria-label={multiple ? `${index + 1} de ${members.length}` : undefined}
            >
              {image ? (
                <div
                  className={
                    member.artwork ? 'home-team-media home-team-artwork' : 'home-team-media'
                  }
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 991px) 100vw, 960px"
                    unoptimized={isManagedPublicMedia(image.src)}
                  />
                </div>
              ) : null}
              <div className="home-team-copy">
                <h2>{member.name}</h2>
                <p>{member.title}</p>
                <Link href={member.href} prefetch={false} onFocus={() => setPaused(true)}>
                  Ver perfil
                </Link>
              </div>
            </div>
          </div>
          {multiple ? (
            <div className="home-team-controls" role="group" aria-label="Selecionar perfil">
              {members.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  className="home-team-dot"
                  aria-label={`Ver slide de ${item.name}`}
                  aria-current={index === itemIndex ? 'true' : undefined}
                  onClick={() => {
                    setPaused(true);
                    setPosition(itemIndex);
                  }}
                  onFocus={() => setPaused(true)}
                />
              ))}
              {!reducedMotion ? (
                <button
                  type="button"
                  aria-label={paused ? 'Retomar rotação' : 'Pausar rotação'}
                  onClick={() => setPaused(!paused)}
                >
                  <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
