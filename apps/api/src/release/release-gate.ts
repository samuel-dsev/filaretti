import { Prisma, type PrismaClient } from '@prisma/client';
import { redirectPath } from '../cms/redirects';
import { isPageSections, isTipTapDocument, plainText } from '../domain/content';
import { containsReleaseMarker } from './markers';

export interface ReleaseDatabaseIssue {
  code: string;
  resource: string;
  count: number;
}
export interface ReleaseDatabaseReport {
  ready: boolean;
  checks: number;
  issues: ReleaseDatabaseIssue[];
}
export interface ReleaseEnvironment {
  APP_ENV?: unknown;
  NODE_ENV?: unknown;
  MOCK_CONTENT?: unknown;
  MOCK_INTEGRATIONS?: unknown;
}

const pageRoutes = new Map([
  ['home', '/'],
  ['o-escritorio', '/o-escritorio'],
  ['privacidade', '/privacidade'],
  ['cookies', '/cookies'],
]);
const staticRoutes = new Set([
  '/areas-de-atuacao',
  '/profissionais',
  '/conteudos',
  '/contato',
  '/newsletter',
  '/busca',
  '/perguntas-frequentes',
]);

type ScanPage = {
  where?: { id: { gt: string } };
  orderBy: { id: 'asc' };
  take: number;
};

class Inspection {
  checks = 0;
  private readonly issues = new Map<string, ReleaseDatabaseIssue>();

  check(code: string, resource: string, failures: number | boolean) {
    this.checks += 1;
    const count = typeof failures === 'boolean' ? Number(failures) : failures;
    if (count === 0) return;
    const key = `${code}:${resource}`;
    const previous = this.issues.get(key);
    this.issues.set(key, { code, resource, count: (previous?.count ?? 0) + count });
  }

  async scan<T extends { id: string; isMock: boolean }>(
    resource: string,
    fetch: (page: ScanPage) => Promise<T[]>,
    inspect?: (row: T) => void,
  ) {
    let cursor: string | undefined;
    let mocks = 0;
    let markers = 0;
    let count = 0;
    for (;;) {
      const rows = await fetch({
        ...(cursor ? { where: { id: { gt: cursor } } } : {}),
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const row of rows) {
        count += 1;
        mocks += Number(row.isMock);
        markers += Number(containsReleaseMarker(row));
        inspect?.(row);
      }
      if (rows.length < 200) break;
      cursor = rows.at(-1)!.id;
    }
    this.check('MOCK_RECORD', resource, mocks);
    this.check('RELEASE_MARKER', resource, markers);
    return count;
  }

  report(): ReleaseDatabaseReport {
    const issues = [...this.issues.values()].sort(
      (left, right) =>
        left.resource.localeCompare(right.resource) || left.code.localeCompare(right.code),
    );
    return { ready: issues.length === 0, checks: this.checks, issues };
  }
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function publicSlug(value: string): boolean {
  return value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}
function documentHasText(value: unknown): boolean {
  return isTipTapDocument(value) && nonempty(plainText(value));
}
function sectionsHaveText(value: unknown): boolean {
  return (
    isPageSections(value) &&
    value.length > 0 &&
    value.every((section) => documentHasText(section.body))
  );
}
function httpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function publicRouteExists(
  tx: Prisma.TransactionClient,
  path: string,
  publicPages: Set<string>,
  now: Date,
): Promise<boolean> {
  if (staticRoutes.has(path) || publicPages.has(path)) return true;
  const match = /^\/(conteudos|profissionais|areas-de-atuacao)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(
    path,
  );
  if (!match) return false;
  const slug = match[2]!;
  if (!publicSlug(slug)) return false;
  if (match[1] === 'conteudos')
    return Boolean(
      await tx.article.findFirst({
        where: {
          slug,
          status: 'PUBLISHED',
          publishedAt: { lte: now },
          isMock: false,
          author: { isActive: true, isMock: false },
        },
        select: { id: true },
      }),
    );
  if (match[1] === 'profissionais')
    return Boolean(
      await tx.professional.findFirst({
        where: { slug, isActive: true, isMock: false },
        select: { id: true },
      }),
    );
  return Boolean(
    await tx.practiceArea.findFirst({
      where: { slug, isActive: true, isMock: false },
      select: { id: true },
    }),
  );
}

/** Database/configuration inspection only; ready does not grant publication or legal approval. */
export async function inspectReleaseDatabase(
  db: PrismaClient,
  environment: ReleaseEnvironment,
): Promise<ReleaseDatabaseReport> {
  const inspection = new Inspection();
  inspection.check('ENVIRONMENT_NOT_PRODUCTION', 'APP_ENV', environment.APP_ENV !== 'production');
  inspection.check('ENVIRONMENT_NOT_PRODUCTION', 'NODE_ENV', environment.NODE_ENV !== 'production');
  for (const key of ['MOCK_CONTENT', 'MOCK_INTEGRATIONS'] as const)
    inspection.check(
      'MOCK_FLAG_NOT_FALSE',
      key,
      environment[key] !== false && environment[key] !== 'false',
    );

  return db.$transaction(
    async (tx) => {
      // PostgreSQL enforces this invariant even when a future check accidentally attempts a write.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const now = new Date();
      let activeAdmins = 0;
      await inspection.scan(
        'user',
        (page) =>
          tx.user.findMany({
            ...page,
            select: { id: true, isMock: true, name: true, email: true, role: true, isActive: true },
          }),
        (row) => {
          if (
            row.role === 'ADMIN' &&
            row.isActive &&
            !row.isMock &&
            !containsReleaseMarker({ name: row.name, email: row.email })
          )
            activeAdmins += 1;
        },
      );
      inspection.check('ACTIVE_ADMIN_MISSING', 'user', activeAdmins === 0);
      await inspection.scan(
        'professional',
        (page) =>
          tx.professional.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              slug: true,
              name: true,
              title: true,
              bio: true,
              education: true,
              experience: true,
              isActive: true,
            },
          }),
        (row) => {
          if (row.isActive) {
            inspection.check('PUBLIC_PATH_INVALID', 'professional', !publicSlug(row.slug));
            inspection.check('PUBLIC_CONTENT_EMPTY', 'professional', !documentHasText(row.bio));
          }
        },
      );
      await inspection.scan(
        'practiceArea',
        (page) =>
          tx.practiceArea.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              slug: true,
              name: true,
              summary: true,
              description: true,
              services: true,
              isActive: true,
            },
          }),
        (row) => {
          if (row.isActive) {
            inspection.check('PUBLIC_PATH_INVALID', 'practiceArea', !publicSlug(row.slug));
            inspection.check(
              'PUBLIC_CONTENT_EMPTY',
              'practiceArea',
              !nonempty(row.summary) || !documentHasText(row.description),
            );
          }
        },
      );
      await inspection.scan(
        'article',
        (page) =>
          tx.article.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              slug: true,
              title: true,
              excerpt: true,
              content: true,
              seoTitle: true,
              seoDescription: true,
              status: true,
              publishedAt: true,
              author: { select: { isActive: true, isMock: true } },
            },
          }),
        (row) => {
          if (row.status !== 'PUBLISHED') return;
          inspection.check('PUBLIC_PATH_INVALID', 'article', !publicSlug(row.slug));
          inspection.check(
            'PUBLICATION_DATE_INVALID',
            'article',
            !row.publishedAt || row.publishedAt > now,
          );
          inspection.check(
            'PUBLIC_AUTHOR_INVALID',
            'article',
            !row.author.isActive || row.author.isMock,
          );
          inspection.check(
            'PUBLIC_CONTENT_EMPTY',
            'article',
            !nonempty(row.title) || !nonempty(row.excerpt) || !documentHasText(row.content),
          );
        },
      );
      for (const resource of ['category', 'tag'] as const)
        await inspection.scan(resource, (page) => {
          const args = {
            ...page,
            select: { id: true, isMock: true, slug: true, name: true },
          } as const;
          return resource === 'category' ? tx.category.findMany(args) : tx.tag.findMany(args);
        });
      const publicPages = new Set<string>();
      await inspection.scan(
        'page',
        (page) =>
          tx.page.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              slug: true,
              title: true,
              sections: true,
              seoTitle: true,
              seoDescription: true,
              status: true,
              publishedAt: true,
            },
          }),
        (row) => {
          if (row.status !== 'PUBLISHED') return;
          const contentValid = nonempty(row.title) && sectionsHaveText(row.sections);
          const dateValid = row.publishedAt !== null && row.publishedAt <= now;
          inspection.check('PUBLIC_CONTENT_EMPTY', 'page', !contentValid);
          inspection.check('PUBLICATION_DATE_INVALID', 'page', !dateValid);
          const route = pageRoutes.get(row.slug);
          if (route && contentValid && dateValid && !row.isMock && !containsReleaseMarker(row))
            publicPages.add(route);
        },
      );
      for (const [slug, route] of pageRoutes)
        inspection.check('REQUIRED_PAGE_MISSING', `page:${slug}`, !publicPages.has(route));
      await inspection.scan(
        'faq',
        (page) =>
          tx.faq.findMany({
            ...page,
            select: { id: true, isMock: true, question: true, answer: true, isActive: true },
          }),
        (row) => {
          if (row.isActive)
            inspection.check(
              'PUBLIC_CONTENT_EMPTY',
              'faq',
              !nonempty(row.question) || !documentHasText(row.answer),
            );
        },
      );
      let settingsConfigured = false;
      await inspection.scan(
        'siteSetting',
        (page) =>
          tx.siteSetting.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              siteName: true,
              publicEmail: true,
              publicPhone: true,
              whatsappUrl: true,
              address: true,
              socialLinks: true,
            },
          }),
        (row) => {
          if (row.id === 'site')
            settingsConfigured =
              nonempty(row.siteName) &&
              nonempty(row.publicEmail) &&
              nonempty(row.publicPhone) &&
              typeof row.address === 'object' &&
              row.address !== null &&
              !Array.isArray(row.address) &&
              Object.values(row.address).some(nonempty);
        },
      );
      inspection.check('SITE_SETTINGS_INCOMPLETE', 'siteSetting', !settingsConfigured);
      await inspection.scan(
        'media',
        (page) =>
          tx.media.findMany({
            ...page,
            select: {
              id: true,
              isMock: true,
              storageKey: true,
              storageDriver: true,
              publicUrl: true,
              alt: true,
              source: true,
              license: true,
              visibility: true,
              mimeType: true,
              size: true,
              _count: { select: { contactAttachments: true } },
            },
          }),
        (row) => {
          inspection.check('LOCAL_MEDIA', 'media', row.storageDriver !== 'r2');
          inspection.check(
            'PRIVATE_MEDIA_EXPOSED',
            'media',
            row.visibility === 'PRIVATE' && row.publicUrl !== null,
          );
          if (row.visibility !== 'PUBLIC') return;
          inspection.check(
            'PUBLIC_MEDIA_INVALID',
            'media',
            !httpsUrl(row.publicUrl) || row.size <= 0 || row._count.contactAttachments > 0,
          );
          inspection.check(
            'PUBLIC_IMAGE_ALT_MISSING',
            'media',
            row.mimeType.startsWith('image/') && !nonempty(row.alt),
          );
          inspection.check(
            'MEDIA_PROVENANCE_MISSING',
            'media',
            !nonempty(row.source) || !nonempty(row.license),
          );
        },
      );
      await inspection.scan('contact', (page) =>
        tx.contact.findMany({
          ...page,
          select: {
            id: true,
            isMock: true,
            name: true,
            email: true,
            phone: true,
            subject: true,
            message: true,
            privacyVersion: true,
          },
        }),
      );
      await inspection.scan('newsletterSubscriber', (page) =>
        tx.newsletterSubscriber.findMany({
          ...page,
          select: { id: true, isMock: true, email: true, name: true, consentVersion: true },
        }),
      );

      const graph = new Map<string, string>();
      let cursor: string | undefined;
      for (;;) {
        const rows = await tx.redirect.findMany({
          where: { isActive: true, ...(cursor ? { id: { gt: cursor } } : {}) },
          orderBy: { id: 'asc' },
          take: 200,
          select: { id: true, sourcePath: true, targetPath: true, statusCode: true },
        });
        for (const row of rows) {
          inspection.check(
            'REDIRECT_PATH_INVALID',
            'redirect',
            !redirectPath(row.sourcePath) || !redirectPath(row.targetPath),
          );
          inspection.check(
            'REDIRECT_STATUS_INVALID',
            'redirect',
            ![301, 302, 307, 308].includes(row.statusCode),
          );
          inspection.check('RELEASE_MARKER', 'redirect', containsReleaseMarker(row));
          graph.set(row.sourcePath, row.targetPath);
        }
        if (rows.length < 200) break;
        cursor = rows.at(-1)!.id;
      }
      // Cache outcomes, including chains entering a cycle, to keep graph traversal linear.
      const resolved = new Map<string, string | null>();
      for (const source of graph.keys()) {
        const chain: string[] = [];
        const seen = new Set<string>();
        let path = source;
        while (graph.has(path) && !resolved.has(path) && !seen.has(path)) {
          seen.add(path);
          chain.push(path);
          path = graph.get(path)!;
        }
        const terminal = resolved.has(path) ? resolved.get(path)! : seen.has(path) ? null : path;
        for (const member of chain) resolved.set(member, terminal);
        inspection.check('REDIRECT_LOOP', 'redirect', terminal === null);
        inspection.check(
          'REDIRECT_SOURCE_SHADOWS_PUBLIC',
          'redirect',
          await publicRouteExists(tx, source, publicPages, now),
        );
        if (terminal !== null)
          inspection.check(
            'REDIRECT_TARGET_NOT_PUBLIC',
            'redirect',
            !(await publicRouteExists(tx, terminal, publicPages, now)),
          );
      }
      return inspection.report();
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 120000,
    },
  );
}

/** Rendered public routes for candidate HTTP inspection; not an expected indexable sitemap. */
export function publicReleasePaths(db: PrismaClient): Promise<string[]> {
  return collectReleasePaths(db, false);
}

/** Production sitemap catalog, regardless of whether indexing has been enabled at the HTTP origin. */
export function sitemapReleasePaths(db: PrismaClient): Promise<string[]> {
  return collectReleasePaths(db, true);
}

async function collectReleasePaths(db: PrismaClient, sitemap: boolean): Promise<string[]> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const now = new Date();
      const paths = new Set(sitemap ? [] : [...staticRoutes].filter((path) => path !== '/busca'));
      const pages = await tx.page.findMany({
        where: {
          slug: { in: [...pageRoutes.keys(), ...(sitemap ? ['contato'] : [])] },
          status: 'PUBLISHED',
          publishedAt: { lte: now },
          isMock: false,
        },
        select: { id: true, slug: true },
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const page of pages) paths.add(pageRoutes.get(page.slug) ?? '/contato');
      for (const resource of ['professional', 'practiceArea', 'article'] as const) {
        let cursor: string | undefined;
        for (;;) {
          const args = {
            where: { isMock: false, ...(cursor ? { id: { gt: cursor } } : {}) },
            select: { id: true, slug: true },
            orderBy: { id: 'asc' },
            take: 200,
          } as const;
          const rows =
            resource === 'article'
              ? await tx.article.findMany({
                  ...args,
                  where: {
                    ...args.where,
                    status: 'PUBLISHED',
                    publishedAt: { lte: now },
                    author: { isActive: true, isMock: false },
                  },
                })
              : resource === 'professional'
                ? await tx.professional.findMany({
                    ...args,
                    where: { ...args.where, isActive: true },
                  })
                : await tx.practiceArea.findMany({
                    ...args,
                    where: { ...args.where, isActive: true },
                  });
          const prefix =
            resource === 'article'
              ? '/conteudos'
              : resource === 'professional'
                ? '/profissionais'
                : '/areas-de-atuacao';
          if (sitemap && rows.length > 0) paths.add(prefix);
          for (const row of rows)
            if (sitemap || publicSlug(row.slug)) paths.add(`${prefix}/${row.slug}`);
          if (rows.length < 200) break;
          cursor = rows.at(-1)!.id;
        }
      }
      if (
        sitemap &&
        (await tx.faq.findFirst({
          where: {
            isActive: true,
            isMock: false,
            OR: [{ practiceAreaId: null }, { practiceArea: { isActive: true, isMock: false } }],
          },
          select: { id: true },
        }))
      )
        paths.add('/perguntas-frequentes');
      return [...paths].sort();
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 120000,
    },
  );
}
