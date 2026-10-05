import 'reflect-metadata';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validateApiEnvironment, validateWebEnvironment } from '@filaretti/config';
import { parseMigrationBatch, type MigrationBatch } from '../src/release/migration-contract';
import {
  inspectReleaseDatabase,
  publicReleasePaths,
  sitemapReleasePaths,
} from '../src/release/release-gate';
import { checkReleaseEvidence } from '../src/release/release-evidence';
import { inspectCandidateHttp } from '../src/release/candidate-http';
import { verifyImportedBatch } from '../src/release/migration-importer';

async function readJson(path: string): Promise<unknown> {
  if ((await stat(path)).size > 10_000_000) throw new Error('INPUT_TOO_LARGE');
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
async function main() {
  const { values } = parseArgs({
    options: {
      checklist: { type: 'string' },
      batch: { type: 'string' },
      http: { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
    },
  });
  const root = resolve(__dirname, '../../..');
  const manifest = (await readJson(resolve(root, 'package.json'))) as { version: string };
  const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  let batch: MigrationBatch | null = null;
  const commandIssues: { code: string; field: string }[] = [];
  const changed = execFileSync(
    'git',
    ['-C', root, 'status', '--porcelain', '--untracked-files=normal'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();
  if (changed) commandIssues.push({ code: 'WORKTREE_DIRTY', field: 'artifact' });
  if (values.batch) {
    try {
      batch = parseMigrationBatch(await readJson(resolve(root, values.batch)));
    } catch {
      commandIssues.push({ code: 'BATCH_UNVERIFIED', field: 'batch' });
    }
  }
  const checklist = await readJson(
    resolve(root, values.checklist ?? 'docs/release-checklist.json'),
  );
  const evidence = checkReleaseEvidence(checklist, batch, { version: manifest.version, commit });
  const sourceFiles = [
    'apps/web/src/components/institutional/home-view.tsx',
    'apps/web/src/components/institutional/office-view.tsx',
    'apps/web/src/components/institutional/professional-views.tsx',
    'apps/web/src/components/site/content-cards.tsx',
  ];
  const sourceIssues: { code: string; resource: string; count: number }[] = [];
  for (const path of sourceFiles) {
    try {
      const source = await readFile(resolve(root, path), 'utf8');
      const count = [
        ...source.matchAll(/PlaceholderArtwork|Retrato em preparação|Retrato de demonstração/gu),
      ].length;
      if (count) sourceIssues.push({ code: 'SOURCE_PLACEHOLDER', resource: path, count });
    } catch {
      sourceIssues.push({ code: 'SOURCE_UNVERIFIED', resource: path, count: 1 });
    }
  }
  let configurationReady = false;
  if (!values.offline) {
    try {
      const api = validateApiEnvironment(process.env);
      const web = validateWebEnvironment(process.env);
      configurationReady =
        api.APP_ENV === 'production' &&
        api.NODE_ENV === 'production' &&
        api.STORAGE_DRIVER === 'r2' &&
        api.R2_ENABLED &&
        api.RESEND_ENABLED &&
        api.TURNSTILE_ENABLED &&
        api.RELATIONSHIP_ENABLED &&
        api.CMS_WORKER_ENABLED &&
        api.RELATIONSHIP_WORKER_ENABLED &&
        api.CONTACT_SCANNER_DRIVER === 'clamav' &&
        web.appEnvironment === 'production' &&
        !web.mockContent &&
        !web.mockIntegrations &&
        web.seoIndexingEnabled &&
        evidence.checklist?.finalOrigin === api.WEB_PUBLIC_URL &&
        evidence.checklist.finalOrigin === web.publicSiteUrl;
    } catch {
      /* Do not print schema exceptions or environment values. */
    }
    if (!configurationReady)
      commandIssues.push({ code: 'PRODUCTION_CONFIGURATION_UNVERIFIED', field: 'configuration' });
  } else commandIssues.push({ code: 'OFFLINE_CHECK_ONLY', field: 'database' });
  let database: Awaited<ReturnType<typeof inspectReleaseDatabase>> | null = null;
  let http: Awaited<ReturnType<typeof inspectCandidateHttp>> | null = null;
  let db: PrismaClient | undefined;
  try {
    if (!values.offline && process.env.DATABASE_URL) {
      db = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: process.env.DATABASE_URL,
          max: 2,
          connectionTimeoutMillis: 5000,
        }),
        log: [],
        errorFormat: 'minimal',
      });
      database = await inspectReleaseDatabase(db, process.env);
      if (batch) {
        const imported = await verifyImportedBatch(db, batch);
        if (!imported.ready) commandIssues.push({ code: imported.code!, field: 'importedBatch' });
      }
      if (values.http) {
        if (!configurationReady || !evidence.checklist?.finalOrigin)
          commandIssues.push({ code: 'HTTP_CONFIGURATION_UNVERIFIED', field: 'http' });
        else
          http = await inspectCandidateHttp(
            evidence.checklist.finalOrigin,
            await publicReleasePaths(db),
            evidence.checklist.candidatePaths,
            fetch,
            await sitemapReleasePaths(db),
            batch?.urls ?? [],
          );
      }
    } else if (!values.offline)
      commandIssues.push({ code: 'DATABASE_UNVERIFIED', field: 'database' });
  } catch {
    commandIssues.push({ code: 'RUNTIME_UNVERIFIED', field: 'runtime' });
  } finally {
    await db?.$disconnect();
  }
  if (!http) commandIssues.push({ code: 'CANDIDATE_HTTP_UNVERIFIED', field: 'http' });
  const ready =
    evidence.ready &&
    sourceIssues.length === 0 &&
    database?.ready === true &&
    http?.ready === true &&
    commandIssues.length === 0;
  process.stdout.write(
    JSON.stringify({
      ready,
      version: manifest.version,
      commit,
      fixture: batch?.fixture ?? null,
      batchSha256: batch?.sha256 ?? null,
      evidence: { ready: evidence.ready, issues: evidence.issues },
      sources: { ready: sourceIssues.length === 0, issues: sourceIssues },
      database,
      http,
      issues: commandIssues,
    }) + '\n',
  );
  if (!ready) process.exitCode = 1;
}
main().catch(() => {
  process.stderr.write(
    JSON.stringify({ ready: false, issues: [{ code: 'RELEASE_CHECK_FAILED', field: 'command' }] }) +
      '\n',
  );
  process.exitCode = 1;
});
