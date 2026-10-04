import type { MetadataRoute } from 'next';
import { getSitemap } from '@/lib/public-api';
import { indexingEnabled, publicUrl } from '@/lib/public-metadata';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return [];
  const entries: MetadataRoute.Sitemap = [];
  const first = await getSitemap({ page: 1, limit: 50 });
  if (first.meta.total > 50000) throw new Error('Sitemap requires partitioning.');
  for (let page = 1; page <= first.meta.pages; page++) {
    const batch = page === 1 ? first : await getSitemap({ page, limit: 50 });
    for (const entry of batch.data) {
      const url = publicUrl(entry.path);
      if (url) entries.push({ url, lastModified: entry.updatedAt });
    }
  }
  return entries;
}
