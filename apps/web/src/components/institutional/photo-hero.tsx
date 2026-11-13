import Image from 'next/image';

export function PhotoHero({
  headingId,
  title,
  description,
}: {
  headingId: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="institution-photo-hero" aria-labelledby={headingId}>
      <Image
        src="/brand/escritorio-ilustrativo.webp"
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
