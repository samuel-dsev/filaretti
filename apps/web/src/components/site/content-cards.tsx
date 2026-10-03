import Image from 'next/image';
import Link from 'next/link';
import { Badge, Card } from '@filaretti/ui';
import { ArrowIcon } from './icons';
import type { EditorialCardProps, PracticeAreaCardProps, ProfessionalCardProps } from './types';

export function EditorialCard({
  category,
  title,
  description,
  href,
  dateLabel,
  readingTimeLabel,
  image,
  label,
}: EditorialCardProps) {
  return (
    <Card className="site-editorial-card">
      {image ? (
        <div className="site-editorial-image">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="site-editorial-art" aria-hidden="true">
          <span />
        </div>
      )}
      <div className="site-editorial-body">
        <div className="site-editorial-meta">
          <span className="site-eyebrow">{category}</span>
          {label ? <Badge>{label}</Badge> : null}
        </div>
        <h3>
          {href ? (
            <Link href={href} className="site-card-title-link">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <p>{description}</p>
        {dateLabel || readingTimeLabel ? (
          <div className="site-card-meta">
            {dateLabel ? <span>{dateLabel}</span> : null}
            {readingTimeLabel ? <span>{readingTimeLabel}</span> : null}
          </div>
        ) : null}
        {href ? (
          <Link href={href} className="site-card-link" aria-label={`Ler: ${title}`}>
            Ler conteúdo
            <ArrowIcon />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

export function PracticeAreaCard({ number, title, description, href }: PracticeAreaCardProps) {
  return (
    <Card className="site-practice-card">
      <div className="site-practice-top">
        {number ? (
          <span className="site-practice-number" aria-hidden="true">
            {number}
          </span>
        ) : (
          <span />
        )}
        {href ? <ArrowIcon diagonal /> : null}
      </div>
      <h3>
        {href ? (
          <Link href={href} className="site-card-title-link">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <p>{description}</p>
      {href ? (
        <Link href={href} className="site-card-link" aria-label={`Conhecer área: ${title}`}>
          Conhecer a área
          <ArrowIcon />
        </Link>
      ) : null}
    </Card>
  );
}

export function ProfessionalCard({
  name,
  role,
  description,
  href,
  image,
  areas,
}: ProfessionalCardProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('');

  return (
    <Card className="site-professional-card">
      {image ? (
        <div className="site-professional-image">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="site-professional-placeholder">
          <span aria-hidden="true">{initials}</span>
          <small>Retrato de demonstração</small>
        </div>
      )}
      <div className="site-professional-body">
        <p className="site-eyebrow">{role}</p>
        <h3>
          {href ? (
            <Link href={href} className="site-card-title-link">
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        {description ? <p>{description}</p> : null}
        {areas?.length ? (
          <ul className="site-professional-areas" aria-label="Áreas de atuação">
            {areas.map((area) => (
              <li key={area}>
                <Badge>{area}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {href ? (
          <Link href={href} className="site-card-link" aria-label={`Conhecer perfil: ${name}`}>
            Conhecer perfil
            <ArrowIcon />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
