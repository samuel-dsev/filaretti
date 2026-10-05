import { containsReleaseMarker } from './markers';
import { redirectPath } from '../cms/redirects';
import type { MigrationUrl } from './migration-contract';

export interface CandidateHttpReport {
  ready: boolean;
  phase: 'controlled' | 'public';
  pages: number;
  issues: { code: string; page: number | null }[];
}
async function boundedResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error('EMPTY_RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2_000_000) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).toString('utf8');
}
function attributes(tag: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of tag.matchAll(/([a-zA-Z-]+)\s*=\s*(["'])(.*?)\2/gu))
    values.set(match[1]!.toLowerCase(), match[3]!);
  return values;
}
function xmlText(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}
function blocksAllCrawlers(text: string): boolean {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let rulesStarted = false;
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*(user-agent|disallow|allow)\s*:\s*(.*?)\s*$/iu.exec(line.split('#')[0]!);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2]!;
    if (key === 'user-agent') {
      if (!group || rulesStarted) {
        group = { agents: [], disallow: [], allow: [] };
        groups.push(group);
        rulesStarted = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group) {
      rulesStarted = true;
      if (value) group[key === 'allow' ? 'allow' : 'disallow'].push(value);
    }
  }
  return (
    groups.some((value) => value.agents.includes('*')) &&
    groups.every((value) => value.disallow.includes('/') && value.allow.length === 0)
  );
}
export async function inspectCandidateHttp(
  origin: string,
  publicPaths: string[],
  candidatePaths: string[],
  request: typeof fetch = fetch,
  sitemapPaths = publicPaths,
  mappings: MigrationUrl[] = [],
  phase: 'controlled' | 'public' = 'public',
): Promise<CandidateHttpReport> {
  const base = new URL(origin);
  if (
    base.protocol !== 'https:' ||
    base.origin !== origin ||
    containsReleaseMarker(origin) ||
    base.username ||
    base.password ||
    publicPaths.length > 10000 ||
    candidatePaths.length > 2000 ||
    sitemapPaths.length > 10000 ||
    !publicPaths.every(redirectPath) ||
    !candidatePaths.every(redirectPath) ||
    !sitemapPaths.every((path) => redirectPath(path) && publicPaths.includes(path)) ||
    !['controlled', 'public'].includes(phase)
  )
    throw new Error('INVALID_CANDIDATE_ORIGIN');
  const issues: CandidateHttpReport['issues'] = [];
  const add = (code: string, page: number | null) => issues.push({ code, page });
  const expected = new Set(publicPaths.map((path) => new URL(path, origin).href));
  const expectedSitemap = new Set(
    (phase === 'public' ? sitemapPaths : []).map((path) => new URL(path, origin).href),
  );
  if (
    mappings.length > 2000 ||
    !mappings.every(
      (mapping) =>
        redirectPath(mapping.sourcePath) &&
        (mapping.targetPath === null || redirectPath(mapping.targetPath)),
    )
  )
    throw new Error('INVALID_CANDIDATE_MAPPING');
  async function read(path: string): Promise<{ text: string; response: Response }> {
    const response = await request(new URL(path, origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { Accept: path.endsWith('.xml') ? 'application/xml' : 'text/html' },
    });
    if (response.status !== 200) throw new Error('UNEXPECTED_HTTP_STATUS');
    return { text: await boundedResponse(response), response };
  }
  try {
    const { text } = await read('/sitemap.xml');
    const urls = [...text.matchAll(/<loc>(.*?)<\/loc>/gsu)].map((match) => xmlText(match[1]!));
    if (
      !/<urlset\b/u.test(text) ||
      /<!DOCTYPE|<!ENTITY/iu.test(text) ||
      urls.length !== expectedSitemap.size ||
      new Set(urls).size !== urls.length ||
      urls.some((url) => !expectedSitemap.has(url))
    )
      add('SITEMAP_MISMATCH', null);
    if (containsReleaseMarker(urls)) add('SITEMAP_PLACEHOLDER', null);
  } catch {
    add('SITEMAP_UNVERIFIED', null);
  }
  try {
    const { text } = await read('/robots.txt');
    if (phase === 'public') {
      if (
        !/^Sitemap:\s*/imu.test(text) ||
        !text.includes(new URL('/sitemap.xml', origin).href) ||
        /^Disallow:\s*\/\s*$/imu.test(text)
      )
        add('ROBOTS_INDEXING_BLOCKED', null);
    } else if (!blocksAllCrawlers(text)) add('CONTROLLED_ROBOTS_UNPROTECTED', null);
  } catch {
    add('ROBOTS_UNVERIFIED', null);
  }
  const paths = [...new Set([...publicPaths, ...candidatePaths])];
  let pages = 0;
  for (const [index, path] of paths.entries()) {
    if (!expected.has(new URL(path, origin).href)) {
      add('CANDIDATE_NOT_PUBLIC', index);
      continue;
    }
    try {
      const { text, response } = await read(path);
      pages++;
      if (!response.headers.get('content-type')?.includes('text/html'))
        add('PAGE_CONTENT_TYPE', index);
      const visibleText = text
        .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu, '')
        .replace(/<[^>]*>/gu, ' ');
      const publicAttributes = [...text.matchAll(/<(?:img|a|meta|link)\b[^>]*>/giu)].flatMap(
        (match) => {
          const values = attributes(match[0]);
          return ['alt', 'src', 'href', 'content'].map((key) => values.get(key) ?? '');
        },
      );
      if (containsReleaseMarker([visibleText, publicAttributes])) add('PAGE_PLACEHOLDER', index);
      const tags = [...text.matchAll(/<(?:link|meta)\b[^>]*>/giu)].map((match) =>
        attributes(match[0]),
      );
      const canonicals = tags.filter((tag) => tag.get('rel')?.toLowerCase() === 'canonical');
      if (
        canonicals.length !== 1 ||
        xmlText(canonicals[0]?.get('href') ?? '') !== new URL(path, origin).href
      )
        add('CANONICAL_MISMATCH', index);
      const noindex =
        tags.some(
          (tag) =>
            tag.get('name')?.toLowerCase() === 'robots' &&
            /noindex|none/iu.test(tag.get('content') ?? ''),
        ) || /noindex|none/iu.test(response.headers.get('x-robots-tag') ?? '');
      if (phase === 'public' && noindex) add('PAGE_NOINDEX', index);
      if (phase === 'controlled' && !noindex) add('CONTROLLED_PAGE_INDEXABLE', index);
      if (!/<title>[^<]+<\/title>/iu.test(text) || !/<h1(?:\s|>)/iu.test(text))
        add('PAGE_METADATA_MISSING', index);
    } catch {
      add('PAGE_UNVERIFIED', index);
    }
  }
  for (const [index, mapping] of mappings.entries()) {
    if (mapping.decision === 'keep') continue;
    try {
      const response = await request(new URL(mapping.sourcePath, origin), {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      try {
        if (mapping.decision === 'remove') {
          if (![404, 410].includes(response.status)) add('REMOVAL_HTTP_MISMATCH', index);
        } else {
          const location = response.headers.get('location');
          if (
            response.status !== 301 ||
            !location ||
            new URL(location, origin).href !== new URL(mapping.targetPath!, origin).href
          )
            add('REDIRECT_HTTP_MISMATCH', index);
        }
      } finally {
        await response.body?.cancel().catch(() => undefined);
      }
    } catch {
      add('MAPPING_HTTP_UNVERIFIED', index);
    }
  }
  return { ready: issues.length === 0 && pages > 0, phase, pages, issues };
}
