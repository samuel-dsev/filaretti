import type { MetadataRoute } from 'next';
import { indexingEnabled, publicUrl } from '@/lib/public-metadata';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/preview/',
        '/api/',
        '/busca',
        '/dev/',
        '/newsletter/',
        '/recuperar-senha',
      ],
    },
    sitemap: publicUrl('/sitemap.xml'),
  };
}
