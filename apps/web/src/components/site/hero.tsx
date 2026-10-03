import { LinkButton } from '@filaretti/ui';
import { ArrowIcon } from './icons';
import type { HeroProps } from './types';

export function Hero({ eyebrow, title, description, actions, visual }: HeroProps) {
  return (
    <section className="site-hero">
      <div className={`f-container site-hero-inner${visual ? ' site-hero-with-visual' : ''}`}>
        <div className="site-hero-copy">
          {eyebrow ? <p className="site-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p className="site-hero-description">{description}</p> : null}
          {actions?.length ? (
            <div className="site-hero-actions">
              {actions.map((action) => (
                <LinkButton
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  variant={action.secondary ? 'secondary' : 'primary'}
                >
                  {action.label}
                  <ArrowIcon />
                </LinkButton>
              ))}
            </div>
          ) : null}
        </div>
        {visual ? <div className="site-hero-visual">{visual}</div> : null}
      </div>
    </section>
  );
}

export function PlaceholderArtwork({
  label = 'Ilustração de demonstração · imagem substituível',
}: {
  label?: string;
}) {
  return (
    <figure className="site-artwork">
      <div className="site-artwork-scene" aria-hidden="true">
        <span className="site-artwork-orbit" />
        <span className="site-artwork-plane site-artwork-plane-back" />
        <span className="site-artwork-plane site-artwork-plane-front" />
        <span className="site-artwork-line" />
        <span className="site-artwork-serif">F</span>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
