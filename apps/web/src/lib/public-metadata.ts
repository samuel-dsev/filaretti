import 'server-only';

import type { Metadata } from 'next';
import { validateWebEnvironment } from '@filaretti/config';
import type { PublicMedia } from '@filaretti/types';
import { safeMediaUrl } from './public-content-core';

export interface PublicMetadataInput {
  title: string;
  description?: string | null;
  path: string;
  noIndex?: boolean;
  image?: PublicMedia | null;
  article?: { publishedAt: string; updatedAt: string };
}

function plainMetadata(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, limit)
    .trimEnd();
}

export function indexingEnabled(): boolean {
  try {
    const environment = validateWebEnvironment(process.env);
    return environment.appEnvironment === 'production' && environment.seoIndexingEnabled;
  } catch {
    return false;
  }
}

export function publicUrl(path: string): string | undefined {
  let canonical: string | undefined;
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    if (
      ['https:', 'http:'].includes(base.protocol) &&
      !base.username &&
      !base.password &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      !/[\u0000-\u0020\u007f\\]/u.test(path)
    ) {
      const url = new URL(path, base.origin);
      if (url.origin === base.origin) canonical = `${url.origin}${url.pathname}`;
    }
  } catch {
    // Configuration is validated by Next; avoid constructing a canonical from an invalid value.
  }
  return canonical;
}

export function publicMetadata({
  title,
  description,
  path,
  noIndex = false,
  image,
  article,
}: PublicMetadataInput): Metadata {
  const canonical = publicUrl(path);
  const safeDescription = description ? plainMetadata(description, 170) : undefined;
  const safeTitle = plainMetadata(title, 70);
  const imageUrl = image ? safeMediaUrl(image.url) : null;
  const absoluteImage = imageUrl && canonical ? new URL(imageUrl, canonical).href : undefined;
  const images = absoluteImage
    ? [{ url: absoluteImage, ...(image?.alt ? { alt: plainMetadata(image.alt, 200) } : {}) }]
    : undefined;
  const index = indexingEnabled() && !noIndex;
  return {
    title: safeTitle,
    ...(safeDescription ? { description: safeDescription } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: { index, follow: index },
    openGraph: {
      title: safeTitle,
      description: safeDescription,
      url: canonical,
      locale: 'pt_BR',
      images,
      ...(article
        ? { type: 'article', publishedTime: article.publishedAt, modifiedTime: article.updatedAt }
        : { type: 'website' }),
    },
    twitter: {
      card: absoluteImage ? 'summary_large_image' : 'summary',
      title: safeTitle,
      description: safeDescription,
      ...(absoluteImage ? { images: [absoluteImage] } : {}),
    },
  };
}
