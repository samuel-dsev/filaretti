import 'server-only';

import type { Metadata } from 'next';

export interface PublicMetadataInput {
  title: string;
  description?: string | null;
  path: string;
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

export function publicMetadata({ title, description, path }: PublicMetadataInput): Metadata {
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
  const safeDescription = description ? plainMetadata(description, 170) : undefined;
  return {
    title: plainMetadata(title, 70),
    ...(safeDescription ? { description: safeDescription } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: { index: false, follow: false },
  };
}
