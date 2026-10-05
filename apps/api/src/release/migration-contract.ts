import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { isUUID, validateSync } from 'class-validator';
import {
  ArticleDto,
  FaqDto,
  PageDto,
  PracticeAreaDto,
  ProfessionalDto,
  SettingsPatchDto,
  TaxonomyDto,
} from '../domain/dto';
import { redirectPath } from '../cms/redirects';
import { containsReleaseMarker } from './markers';

export type MigrationKind =
  'category' | 'tag' | 'practiceArea' | 'professional' | 'article' | 'page' | 'faq' | 'settings';
type DataByKind = {
  category: TaxonomyDto;
  tag: TaxonomyDto;
  practiceArea: PracticeAreaDto;
  professional: ProfessionalDto;
  article: ArticleDto;
  page: PageDto;
  faq: FaqDto;
  settings: SettingsPatchDto;
};
export type MigrationRecord = {
  [K in MigrationKind]: {
    kind: K;
    id: string;
    data: DataByKind[K];
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    publishedAt: Date | null;
  };
}[MigrationKind];
export interface MigrationUrl {
  sourcePath: string;
  decision: 'keep' | 'redirect' | 'remove';
  targetPath: string | null;
  removalApproval: string | null;
  title: string;
  description: string;
  assetPaths: string[];
}
export interface MigrationBatch {
  schemaVersion: 1;
  batchId: string;
  fixture: boolean;
  legacyOrigin: string;
  approval: { reference: string; reviewer: string; approvedAt: string } | null;
  records: MigrationRecord[];
  urls: MigrationUrl[];
  sha256: string;
}
export interface MigrationIssue {
  code: string;
  record: number | null;
}
export class MigrationFailure extends Error {
  constructor(public readonly issues: MigrationIssue[]) {
    super('MIGRATION_REJECTED');
  }
}
function fail(code: string, record: number | null = null): never {
  throw new MigrationFailure([{ code, record }]);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function utcDate(value: unknown): Date | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  )
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) &&
    date.toISOString() === (value.length === 20 ? value.replace('Z', '.000Z') : value)
    ? date
    : null;
}
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value))
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function migrationDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function dto<K extends MigrationKind>(
  kind: K,
  data: Record<string, unknown>,
  index: number,
): DataByKind[K] {
  const classes = {
    category: TaxonomyDto,
    tag: TaxonomyDto,
    practiceArea: PracticeAreaDto,
    professional: ProfessionalDto,
    article: ArticleDto,
    page: PageDto,
    faq: FaqDto,
    settings: SettingsPatchDto,
  };
  // The switch preserves each DTO's decorators; unknown fields are rejected instead of silently dropped.
  const value = plainToInstance(
    classes[kind] as new () => object,
    kind === 'settings' ? { ...data, version: 1 } : data,
  );
  if (
    kind === 'settings' &&
    ('version' in data || typeof data.siteName !== 'string' || !data.siteName.trim())
  )
    fail('INVALID_SETTINGS', index);
  if (
    validateSync(value, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true })
      .length
  )
    fail('INVALID_RECORD', index);
  return value as DataByKind[K];
}
export function parseMigrationBatch(input: unknown, now = new Date()): MigrationBatch {
  if (
    !object(input) ||
    !keys(input, [
      'schemaVersion',
      'batchId',
      'fixture',
      'legacyOrigin',
      'approval',
      'records',
      'urls',
    ]) ||
    input.schemaVersion !== 1 ||
    !isUUID(input.batchId) ||
    typeof input.fixture !== 'boolean' ||
    !Array.isArray(input.records) ||
    input.records.length === 0 ||
    input.records.length > 1000 ||
    !Array.isArray(input.urls) ||
    input.urls.length > 2000
  )
    fail('INVALID_BATCH');
  let origin: URL;
  try {
    origin = new URL(String(input.legacyOrigin));
  } catch {
    return fail('INVALID_LEGACY_ORIGIN');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== input.legacyOrigin ||
    origin.username ||
    origin.password
  )
    fail('INVALID_LEGACY_ORIGIN');
  const approval = input.approval;
  if (
    approval !== null &&
    (!object(approval) ||
      !keys(approval, ['reference', 'reviewer', 'approvedAt']) ||
      typeof approval.reference !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,159}$/u.test(approval.reference) ||
      typeof approval.reviewer !== 'string' ||
      !approval.reviewer.trim() ||
      approval.reviewer.length > 160 ||
      !utcDate(approval.approvedAt) ||
      utcDate(approval.approvedAt)! > now)
  )
    fail('INVALID_APPROVAL');
  if (!input.fixture && !approval) fail('APPROVAL_REQUIRED');
  if (input.fixture && approval !== null) fail('FIXTURE_APPROVAL_FORBIDDEN');
  if (!input.fixture && containsReleaseMarker(input)) fail('PLACEHOLDER_IN_BATCH');
  const seen = new Set<string>();
  const records: MigrationRecord[] = input.records.map((item: unknown, index: number) => {
    if (
      !object(item) ||
      !keys(item, ['kind', 'id', 'data', 'status', 'publishedAt']) ||
      !object(item.data) ||
      ![
        'category',
        'tag',
        'practiceArea',
        'professional',
        'article',
        'page',
        'faq',
        'settings',
      ].includes(String(item.kind))
    )
      return fail('INVALID_RECORD', index);
    const kind = item.kind as MigrationKind;
    if (kind === 'settings' ? item.id !== 'site' : !isUUID(item.id))
      fail('INVALID_RECORD_ID', index);
    if (seen.has(String(item.id))) fail('DUPLICATE_RECORD_ID', index);
    seen.add(String(item.id));
    const data = dto(kind, item.data, index);
    const editorial = kind === 'article' || kind === 'page';
    if (
      editorial
        ? !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(String(item.status))
        : item.status !== undefined || item.publishedAt !== undefined
    )
      fail('INVALID_PUBLICATION', index);
    const status = editorial ? (item.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') : 'DRAFT';
    const publishedAt = utcDate(item.publishedAt);
    if (
      editorial &&
      (status === 'PUBLISHED' ? !publishedAt || publishedAt > now : item.publishedAt !== null)
    )
      fail('INVALID_PUBLICATION', index);
    if (
      kind === 'page' &&
      !['home', 'o-escritorio', 'privacidade', 'cookies'].includes((data as PageDto).slug)
    )
      fail('PAGE_TEMPLATE_MISSING', index);
    if (kind === 'page' && status === 'PUBLISHED' && (data as PageDto).sections.length === 0)
      fail('EMPTY_PUBLICATION', index);
    return { kind, id: String(item.id), data, status, publishedAt } as MigrationRecord;
  });
  const slugs = new Set<string>();
  for (const [index, record] of records.entries()) {
    if ('slug' in record.data) {
      const key = record.kind + ':' + record.data.slug;
      if (slugs.has(key)) fail('DUPLICATE_SLUG', index);
      slugs.add(key);
    }
  }
  const paths = new Set<string>();
  const urls: MigrationUrl[] = input.urls.map((item: unknown, index: number) => {
    if (
      !object(item) ||
      !keys(item, [
        'sourcePath',
        'decision',
        'targetPath',
        'removalApproval',
        'title',
        'description',
        'assetPaths',
      ]) ||
      !redirectPath(item.sourcePath) ||
      paths.has(item.sourcePath) ||
      !['keep', 'redirect', 'remove'].includes(String(item.decision)) ||
      typeof item.title !== 'string' ||
      item.title.length > 200 ||
      typeof item.description !== 'string' ||
      item.description.length > 500 ||
      !Array.isArray(item.assetPaths) ||
      item.assetPaths.length > 100 ||
      !item.assetPaths.every(
        (path: unknown) =>
          typeof path === 'string' &&
          path.length <= 500 &&
          /^\/[A-Za-z0-9_./-]+$/u.test(path) &&
          !path.split('/').some((part) => part === '..' || part === '.'),
      )
    )
      return fail('INVALID_URL_MAPPING', index);
    if (
      item.decision === 'remove'
        ? item.targetPath !== null ||
          typeof item.removalApproval !== 'string' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,159}$/u.test(item.removalApproval)
        : !redirectPath(item.targetPath) ||
          item.removalApproval !== null ||
          (item.decision === 'keep'
            ? item.targetPath !== item.sourcePath
            : item.targetPath === item.sourcePath)
    )
      fail('INVALID_URL_MAPPING', index);
    paths.add(item.sourcePath);
    return item as unknown as MigrationUrl;
  });
  const graph = new Map(
    urls
      .filter((url) => url.decision === 'redirect')
      .map((url) => [url.sourcePath, url.targetPath!]),
  );
  for (const source of graph.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = source;
    while (current !== undefined) {
      if (visited.has(current)) fail('REDIRECT_LOOP');
      visited.add(current);
      current = graph.get(current);
    }
  }
  return {
    schemaVersion: 1,
    batchId: String(input.batchId),
    fixture: input.fixture,
    legacyOrigin: origin.origin,
    approval: approval as MigrationBatch['approval'],
    records,
    urls,
    sha256: migrationDigest(input),
  };
}
