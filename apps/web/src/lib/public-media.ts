import type { PublicMedia } from '@filaretti/types';

const publicRasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Revocable CMS assets must use the no-store storage facade, never Next's image cache. */
export function isManagedPublicMedia(pathname: string): boolean {
  return /^\/media\/public\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(?:jpe?g|png|webp|avif|pdf)$/iu.test(
    pathname,
  );
}

/** Mirrors Next's image allowlist; private/API paths and external hosts stay excluded. */
export function publicImage(
  media: PublicMedia | null,
  fallbackAlt = '',
): { src: string; alt: string } | undefined {
  if (!media || !publicRasterTypes.has(media.mimeType)) return undefined;
  if (!/^\/media\/public\/[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp|avif)$/u.test(media.url)) {
    return undefined;
  }
  if (media.url.includes('//') || media.url.split('/').includes('..')) return undefined;
  return { src: media.url, alt: media.alt?.trim() || fallbackAlt };
}

/** Only a public editorial PDF reference can produce a download; storage validation joins in F6. */
export function publicPdf(
  media: PublicMedia | null,
): { href: string; sizeLabel: string } | undefined {
  if (
    !media ||
    media.mimeType !== 'application/pdf' ||
    !Number.isSafeInteger(media.size) ||
    media.size <= 0 ||
    media.size > 10 * 1024 * 1024 ||
    !/^\/media\/public\/[a-zA-Z0-9_/-]+\.pdf$/u.test(media.url) ||
    media.url.includes('//') ||
    media.url.split('/').some((part) => part === '.' || part === '..')
  )
    return undefined;
  const megabytes = media.size >= 1024 * 1024;
  const size = media.size / (megabytes ? 1024 * 1024 : 1024);
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(size);
  return { href: media.url, sizeLabel: `${formatted} ${megabytes ? 'MB' : 'KB'}` };
}
