import type { PublicMedia } from '@filaretti/types';

const publicRasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

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
