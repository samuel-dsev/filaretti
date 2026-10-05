import { Prisma, type PrismaClient } from '@prisma/client';
import { plainText } from '../domain/content';
import { json, validateMedia } from '../domain/shared';
import { validateRedirectGraph } from '../cms/redirects';
import { containsReleaseMarker } from './markers';
import {
  MigrationFailure,
  migrationDigest,
  type MigrationBatch,
  type MigrationIssue,
  type MigrationRecord,
} from './migration-contract';

export interface MigrationOptions {
  apply?: boolean;
  actorId: string;
  confirmSha256?: string;
  confirmDatabase?: string;
  environment: Record<string, unknown>;
}
export interface MigrationReport {
  ok: boolean;
  mode: 'dry-run' | 'apply';
  batchId: string;
  sha256: string;
  records: number;
  redirects: number;
  skipped: boolean;
  issues: MigrationIssue[];
}
function reject(code: string, record: number | null = null): never {
  throw new MigrationFailure([{ code, record }]);
}
function recordPath(record: MigrationRecord): string | null {
  switch (record.kind) {
    case 'article':
      return '/conteudos/' + record.data.slug;
    case 'professional':
      return '/profissionais/' + record.data.slug;
    case 'practiceArea':
      return '/areas-de-atuacao/' + record.data.slug;
    case 'page':
      return record.data.slug === 'home' ? '/' : '/' + record.data.slug;
    default:
      return null;
  }
}
async function existing(tx: Prisma.TransactionClient, record: MigrationRecord) {
  const where =
    'slug' in record.data
      ? { OR: [{ id: record.id }, { slug: record.data.slug }] }
      : { id: record.id };
  switch (record.kind) {
    case 'article':
      return tx.article.findFirst({ where, select: { id: true } });
    case 'professional':
      return tx.professional.findFirst({ where, select: { id: true } });
    case 'practiceArea':
      return tx.practiceArea.findFirst({ where, select: { id: true } });
    case 'category':
      return tx.category.findFirst({ where, select: { id: true } });
    case 'tag':
      return tx.tag.findFirst({ where, select: { id: true } });
    case 'page':
      return tx.page.findFirst({ where, select: { id: true } });
    case 'faq':
      return tx.faq.findUnique({ where: { id: record.id }, select: { id: true } });
    case 'settings':
      return tx.siteSetting.findUnique({ where: { id: 'site' } });
  }
}
async function importedSnapshot(
  tx: Prisma.TransactionClient,
  batch: MigrationBatch,
): Promise<string | null> {
  const rows: unknown[] = [];
  for (const record of batch.records) {
    const where = { id: record.id };
    const row =
      record.kind === 'article'
        ? await tx.article.findUnique({
            where,
            include: {
              categories: { orderBy: { categoryId: 'asc' } },
              tags: { orderBy: { tagId: 'asc' } },
              practiceAreas: { orderBy: { practiceAreaId: 'asc' } },
            },
          })
        : record.kind === 'professional'
          ? await tx.professional.findUnique({
              where,
              include: { practiceAreas: { orderBy: { practiceAreaId: 'asc' } } },
            })
          : record.kind === 'practiceArea'
            ? await tx.practiceArea.findUnique({ where })
            : record.kind === 'category'
              ? await tx.category.findUnique({ where })
              : record.kind === 'tag'
                ? await tx.tag.findUnique({ where })
                : record.kind === 'page'
                  ? await tx.page.findUnique({ where })
                  : record.kind === 'faq'
                    ? await tx.faq.findUnique({ where })
                    : await tx.siteSetting.findUnique({ where });
    if (!row) return null;
    rows.push(row);
  }
  for (const url of batch.urls.filter((row) => row.decision === 'redirect')) {
    const row = await tx.redirect.findUnique({ where: { sourcePath: url.sourcePath } });
    if (!row) return null;
    rows.push(row);
  }
  return migrationDigest(rows);
}
export function verifyImportedBatch(
  db: PrismaClient,
  batch: MigrationBatch,
): Promise<{ ready: boolean; code: string | null }> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const receipt = await tx.auditEvent.findFirst({
        where: {
          action: 'migration.imported',
          resource: 'migration-batch',
          resourceId: batch.batchId,
        },
        select: { metadata: true },
      });
      const data = receipt?.metadata;
      if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        data.sha256 !== batch.sha256 ||
        typeof data.snapshotSha256 !== 'string'
      )
        return { ready: false, code: 'IMPORT_RECEIPT_UNVERIFIED' };
      if ((await importedSnapshot(tx, batch)) !== data.snapshotSha256)
        return { ready: false, code: 'IMPORTED_BATCH_DRIFT' };
      return { ready: true, code: null };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 },
  );
}
export async function migrateBatch(
  db: PrismaClient,
  batch: MigrationBatch,
  options: MigrationOptions,
): Promise<MigrationReport> {
  const env = options.environment;
  if (batch.fixture) {
    if (
      env.APP_ENV !== 'development' ||
      env.NODE_ENV !== 'development' ||
      ![true, 'true'].includes(env.MOCK_CONTENT as boolean | string)
    )
      reject('FIXTURE_ENVIRONMENT_REQUIRED');
  } else if (
    env.APP_ENV !== 'production' ||
    env.NODE_ENV !== 'production' ||
    ![false, 'false'].includes(env.MOCK_CONTENT as boolean | string)
  )
    reject('PRODUCTION_ENVIRONMENT_REQUIRED');
  if (options.apply) {
    let database: URL;
    try {
      database = new URL(String(env.DATABASE_URL));
    } catch {
      return reject('DATABASE_CONFIRMATION_REQUIRED');
    }
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      decodeURIComponent(database.pathname.slice(1)) !== options.confirmDatabase ||
      !options.confirmDatabase
    )
      reject('DATABASE_CONFIRMATION_REQUIRED');
    if (options.confirmSha256 !== batch.sha256) reject('DIGEST_CONFIRMATION_REQUIRED');
    if (
      batch.fixture
        ? !/^filaretti_test_[a-f0-9]{32}(?:_structural)?$/u.test(options.confirmDatabase)
        : env.F9_IMPORT_APPROVED !== 'true'
    )
      reject('IMPORT_AUTHORIZATION_REQUIRED');
  }
  const report: MigrationReport = {
    ok: true,
    mode: options.apply ? 'apply' : 'dry-run',
    batchId: batch.batchId,
    sha256: batch.sha256,
    records: batch.records.length,
    redirects: batch.urls.filter((url) => url.decision === 'redirect').length,
    skipped: false,
    issues: [],
  };
  return db.$transaction(
    async (tx) => {
      if (!options.apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      if (options.apply) {
        const database = await tx.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
        if (database[0]?.name !== options.confirmDatabase) reject('DATABASE_CONFIRMATION_REQUIRED');
      }
      // Shared with CMS slug/redirect writes. It serializes concurrent replay of a batch as well.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
      const actor = await tx.user.findUnique({
        where: { id: options.actorId },
        select: { id: true, isActive: true, role: true, isMock: true, email: true, name: true },
      });
      if (
        !actor ||
        !actor.isActive ||
        actor.role !== 'ADMIN' ||
        (!batch.fixture && (actor.isMock || containsReleaseMarker(actor)))
      )
        reject('INVALID_IMPORT_ACTOR');
      const receipt = await tx.auditEvent.findFirst({
        where: {
          action: 'migration.imported',
          resource: 'migration-batch',
          resourceId: batch.batchId,
        },
        select: { metadata: true },
      });
      if (receipt) {
        if (
          !receipt.metadata ||
          typeof receipt.metadata !== 'object' ||
          Array.isArray(receipt.metadata) ||
          receipt.metadata.sha256 !== batch.sha256
        )
          reject('BATCH_DIGEST_CONFLICT');
        for (const [index, record] of batch.records.entries())
          if ((await existing(tx, record))?.id !== record.id)
            reject('IMPORTED_RECORD_MISSING', index);
        report.skipped = true;
        return report;
      }
      const issues: MigrationIssue[] = [];
      const planned = new Map(batch.records.map((record) => [record.id, record]));
      async function relation(
        kind: 'professional' | 'category' | 'tag' | 'practiceArea',
        id: string,
        index: number,
      ) {
        const future = planned.get(id);
        if (future) {
          if (future.kind !== kind || ('isActive' in future.data && future.data.isActive === false))
            issues.push({ code: 'INVALID_RELATION', record: index });
          return;
        }
        const where = { id };
        const select = { id: true, isActive: true, isMock: true };
        const row =
          kind === 'professional'
            ? await tx.professional.findUnique({ where, select })
            : kind === 'category'
              ? await tx.category.findUnique({ where, select })
              : kind === 'tag'
                ? await tx.tag.findUnique({ where, select })
                : await tx.practiceArea.findUnique({ where, select });
        if (!row || !row.isActive || (!batch.fixture && row.isMock))
          issues.push({ code: 'INVALID_RELATION', record: index });
      }
      for (const [index, record] of batch.records.entries()) {
        const current = await existing(tx, record);
        const structure =
          record.kind === 'settings'
            ? await tx.siteSetting.findUnique({ where: { id: 'site' } })
            : null;
        const emptySettings =
          structure !== null &&
          structure.siteName === '' &&
          structure.isMock === false &&
          !structure.publicEmail &&
          !structure.publicPhone &&
          !structure.whatsappUrl &&
          JSON.stringify(structure.address) === '{}' &&
          JSON.stringify(structure.socialLinks) === '[]';
        if (current && !emptySettings) issues.push({ code: 'DESTINATION_CONFLICT', record: index });
        const path = recordPath(record);
        if (
          path &&
          (await tx.redirect.findUnique({ where: { sourcePath: path }, select: { id: true } }))
        )
          issues.push({ code: 'SLUG_RESERVED', record: index });
        const data = record.data;
        if ('authorId' in data) await relation('professional', data.authorId, index);
        if ('categoryIds' in data)
          for (const id of data.categoryIds ?? []) await relation('category', id, index);
        if ('tagIds' in data) for (const id of data.tagIds ?? []) await relation('tag', id, index);
        if ('practiceAreaIds' in data)
          for (const id of data.practiceAreaIds ?? []) await relation('practiceArea', id, index);
        if ('practiceAreaId' in data && data.practiceAreaId)
          await relation('practiceArea', data.practiceAreaId, index);
        for (const [id, kind] of [
          ['photoMediaId' in data ? data.photoMediaId : null, 'image'],
          ['coverMediaId' in data ? data.coverMediaId : null, 'image'],
          ['pdfMediaId' in data ? data.pdfMediaId : null, 'pdf'],
        ] as const) {
          if (!id) continue;
          try {
            await validateMedia(tx, id, kind);
            const medium = await tx.media.findUniqueOrThrow({
              where: { id },
              select: {
                isMock: true,
                storageDriver: true,
                publicUrl: true,
                alt: true,
                source: true,
                license: true,
              },
            });
            if (
              !batch.fixture &&
              (medium.isMock ||
                medium.storageDriver !== 'r2' ||
                containsReleaseMarker(medium) ||
                (kind === 'image' && !medium.alt?.trim()))
            )
              issues.push({ code: 'UNAPPROVED_MEDIA', record: index });
          } catch {
            issues.push({ code: 'INVALID_MEDIA', record: index });
          }
        }
        if (
          record.kind === 'article' &&
          record.status === 'PUBLISHED' &&
          !plainText(record.data.content).trim()
        )
          issues.push({ code: 'EMPTY_PUBLICATION', record: index });
      }
      const now = new Date();
      const publicPaths = new Set([
        '/',
        '/o-escritorio',
        '/areas-de-atuacao',
        '/profissionais',
        '/conteudos',
        '/contato',
        '/newsletter',
        '/perguntas-frequentes',
        '/privacidade',
        '/cookies',
      ]);
      const visible = { ...(batch.fixture ? {} : { isMock: false }) };
      // Exact destination checks use indexed lookups, including planned records; a DB Page.slug alone does not create a Next route.
      async function publiclyExists(path: string): Promise<boolean> {
        const future = batch.records.find((record) => recordPath(record) === path);
        if (future)
          return future.kind === 'article' || future.kind === 'page'
            ? future.status === 'PUBLISHED'
            : 'isActive' in future.data && future.data.isActive !== false;
        if (publicPaths.has(path)) return true;
        if (path.startsWith('/conteudos/'))
          return Boolean(
            await tx.article.findFirst({
              where: {
                slug: path.slice('/conteudos/'.length),
                ...visible,
                status: 'PUBLISHED',
                publishedAt: { lte: now },
                author: { isActive: true, ...visible },
              },
              select: { id: true },
            }),
          );
        if (path.startsWith('/profissionais/'))
          return Boolean(
            await tx.professional.findFirst({
              where: { slug: path.slice('/profissionais/'.length), ...visible, isActive: true },
              select: { id: true },
            }),
          );
        if (path.startsWith('/areas-de-atuacao/'))
          return Boolean(
            await tx.practiceArea.findFirst({
              where: { slug: path.slice('/areas-de-atuacao/'.length), ...visible, isActive: true },
              select: { id: true },
            }),
          );
        return false;
      }
      const redirects = await tx.redirect.findMany({
        where: { isActive: true },
        select: { sourcePath: true, targetPath: true },
      });
      const graph = new Map(redirects.map((row) => [row.sourcePath, row.targetPath]));
      for (const [index, url] of batch.urls.entries()) {
        if (url.decision === 'remove') continue;
        if (url.decision === 'redirect') {
          if (
            await tx.redirect.findUnique({
              where: { sourcePath: url.sourcePath },
              select: { id: true },
            })
          )
            issues.push({ code: 'REDIRECT_CONFLICT', record: index });
          if (await publiclyExists(url.sourcePath))
            issues.push({ code: 'REDIRECT_SHADOWS_PUBLIC_ROUTE', record: index });
          graph.set(url.sourcePath, url.targetPath!);
        }
      }
      for (const [index, url] of batch.urls.entries()) {
        if (url.decision === 'remove') continue;
        const seen = new Set<string>();
        let final = url.targetPath!;
        while (graph.has(final)) {
          if (seen.has(final)) {
            issues.push({ code: 'REDIRECT_LOOP', record: index });
            break;
          }
          seen.add(final);
          final = graph.get(final)!;
        }
        if (!seen.has(final) && !(await publiclyExists(final)))
          issues.push({ code: 'REDIRECT_TARGET_MISSING', record: index });
      }
      if (issues.length) throw new MigrationFailure(issues);
      if (!options.apply) return report;
      const order: MigrationRecord['kind'][] = [
        'category',
        'tag',
        'practiceArea',
        'professional',
        'page',
        'faq',
        'article',
        'settings',
      ];
      for (const kind of order)
        for (const record of batch.records.filter((row) => row.kind === kind)) {
          const base = { id: record.id, isMock: batch.fixture };
          switch (record.kind) {
            case 'category':
              await tx.category.create({ data: { ...base, ...record.data } });
              break;
            case 'tag':
              await tx.tag.create({ data: { ...base, ...record.data } });
              break;
            case 'practiceArea':
              await tx.practiceArea.create({
                data: {
                  ...base,
                  ...record.data,
                  description: json(record.data.description),
                  services: json(record.data.services),
                },
              });
              break;
            case 'professional': {
              const { practiceAreaIds, ...data } = record.data;
              await tx.professional.create({
                data: {
                  ...base,
                  ...data,
                  bio: json(data.bio),
                  education: json(data.education),
                  experience: json(data.experience),
                  practiceAreas: {
                    create: (practiceAreaIds ?? []).map((practiceAreaId) => ({ practiceAreaId })),
                  },
                },
              });
              break;
            }
            case 'page':
              await tx.page.create({
                data: {
                  ...base,
                  ...record.data,
                  sections: json(record.data.sections),
                  status: record.status,
                  publishedAt: record.publishedAt,
                },
              });
              break;
            case 'faq':
              await tx.faq.create({
                data: { ...base, ...record.data, answer: json(record.data.answer) },
              });
              break;
            case 'article': {
              const { categoryIds, tagIds, practiceAreaIds, ...data } = record.data;
              await tx.article.create({
                data: {
                  ...base,
                  ...data,
                  content: json(data.content),
                  createdById: actor.id,
                  updatedById: actor.id,
                  status: record.status,
                  publishedAt: record.publishedAt,
                  readingTimeMinutes: Math.max(
                    1,
                    Math.ceil(plainText(data.content).split(/\s+/u).length / 200),
                  ),
                  categories: { create: (categoryIds ?? []).map((categoryId) => ({ categoryId })) },
                  tags: { create: (tagIds ?? []).map((tagId) => ({ tagId })) },
                  practiceAreas: {
                    create: (practiceAreaIds ?? []).map((practiceAreaId) => ({ practiceAreaId })),
                  },
                },
              });
              break;
            }
            case 'settings': {
              const { address, socialLinks } = record.data;
              const data = {
                siteName: record.data.siteName!,
                publicEmail: record.data.publicEmail,
                publicPhone: record.data.publicPhone,
                whatsappUrl: record.data.whatsappUrl,
              };
              const settings = {
                ...data,
                address: json(address ?? {}),
                socialLinks: json(socialLinks ?? []),
                isMock: batch.fixture,
              };
              await tx.siteSetting.upsert({
                where: { id: 'site' },
                create: { id: 'site', ...settings },
                update: { ...settings, version: { increment: 1 } },
              });
              break;
            }
          }
        }
      for (const url of batch.urls.filter((row) => row.decision === 'redirect')) {
        await validateRedirectGraph(tx, {
          sourcePath: url.sourcePath,
          targetPath: url.targetPath!,
        });
        await tx.redirect.create({
          data: { sourcePath: url.sourcePath, targetPath: url.targetPath!, statusCode: 301 },
        });
      }
      const snapshotSha256 = await importedSnapshot(tx, batch);
      if (!snapshotSha256) reject('IMPORT_SNAPSHOT_FAILED');
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'migration.imported',
          resource: 'migration-batch',
          resourceId: batch.batchId,
          metadata: {
            sha256: batch.sha256,
            snapshotSha256,
            fixture: batch.fixture,
            records: report.records,
            redirects: report.redirects,
          },
        },
      });
      return report;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 60000,
      maxWait: 10000,
    },
  );
}
