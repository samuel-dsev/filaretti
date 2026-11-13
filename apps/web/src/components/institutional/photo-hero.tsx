import Image from 'next/image';

export function PhotoHero({
  headingId,
  title,
  description,
  imageSrc = '/brand/escritorio-ilustrativo.webp',
  fillViewport = false,
}: {
  headingId: string;
  title: string;
  description?: string;
  imageSrc?: string;
  fillViewport?: boolean;
}) {
  return (
    <section
      className={`institution-photo-hero${fillViewport ? ' institution-photo-hero-full' : ''}`}
      aria-labelledby={headingId}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="100vw"
        preload
        className="institution-photo-hero-image"
      />
      <div className="f-container institution-photo-hero-copy">
        <h1 id={headingId}>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
}
