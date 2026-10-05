import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { checkReleaseEvidence } from '../src/release/release-evidence';
import { parseMigrationBatch } from '../src/release/migration-contract';
import { containsReleaseMarker } from '../src/release/markers';
import { inspectCandidateHttp } from '../src/release/candidate-http';

test('pending release checklist and migration template cannot approve a fixture or production', async () => {
  const fixture = JSON.parse(
    await readFile('test/fixtures/migration-batch.json', 'utf8'),
  ) as unknown;
  const batch = parseMigrationBatch(fixture);
  assert.equal(batch.fixture, true);
  assert.equal(batch.records.length, 6);
  const pending = JSON.parse(
    await readFile('../../docs/release-checklist.json', 'utf8'),
  ) as unknown;
  const report = checkReleaseEvidence(pending, batch, { version: '0.9.0', commit: 'a'.repeat(40) });
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'APPROVED_BATCH_REQUIRED'));
  assert.ok(report.issues.some((issue) => issue.code === 'EVIDENCE_MISSING'));
  assert.throws(() => parseMigrationBatch(JSON.parse('false')));
  assert.throws(() => parseMigrationBatch(null));
});

test('release evidence rejects future approvals, wrong commit/hash and protected candidate paths', async () => {
  const pending = JSON.parse(await readFile('../../docs/release-checklist.json', 'utf8')) as Record<
    string,
    unknown
  >;
  pending.approvals = {
    content: {
      reference: 'fixture/ref',
      reviewer: 'Fixture reviewer',
      approvedAt: '2099-01-01T00:00:00Z',
    },
    migration: null,
    privacyRetention: null,
    professionalPresentation: null,
  };
  const report = checkReleaseEvidence(pending, null, { version: '0.9.0', commit: 'a'.repeat(40) });
  assert.ok(report.issues.some((issue) => issue.field === 'approvals.content'));
  (pending.approvals as Record<string, unknown>).content = {
    reference: 'fixture/ref',
    reviewer: 'Fixture reviewer',
    approvedAt: '2026-02-31T00:00:00Z',
  };
  assert.ok(
    checkReleaseEvidence(pending, null, { version: '0.9.0', commit: 'a'.repeat(40) }).issues.some(
      (issue) => issue.field === 'approvals.content',
    ),
  );
  pending.candidatePaths = ['/admin'];
  assert.equal(
    checkReleaseEvidence(pending, null, { version: '0.9.0', commit: 'a'.repeat(40) }).issues[0]
      ?.code,
    'INVALID_CHECKLIST',
  );
});

test('unmarked mock material, oversized/deep/cyclic JSON and local identities are rejected', () => {
  for (const value of [
    'Nome FICTÍCIO',
    'https://example.invalid/photo.png',
    'user@domain.test',
    'user@domain.local',
    'Retrato em preparação',
    'Ilustração de demonstração',
    '0000000000',
    { content: [{ text: 'Lorem ipsum' }] },
  ])
    assert.equal(containsReleaseMarker(value), true);
  const cyclic: { value?: unknown } = {};
  cyclic.value = cyclic;
  assert.equal(containsReleaseMarker(cyclic), true);
  assert.equal(containsReleaseMarker('a'.repeat(100001)), true);
  let deep: unknown = 'Text';
  for (let i = 0; i < 42; i++) deep = { value: deep };
  assert.equal(containsReleaseMarker(deep), true);
  assert.equal(
    containsReleaseMarker({ text: 'Texto da interface', placeholderLabel: 'Informe sua mensagem' }),
    false,
  );
});

test('candidate inspector exercises real local HTTP, canonical, sitemap, robots and mock blockers', async () => {
  // HTTPS candidate URLs are mapped to this owned HTTP fixture; no external host is contacted.
  const origin = 'https://candidate.synthetic-release.org';
  let scenario = 'clean';
  const server = createServer((request, response) => {
    if (request.url === '/old') {
      response.writeHead(scenario === 'redirect' ? 302 : 301, { Location: '/' });
      response.end();
      return;
    }
    if (request.url === '/withdrawn') {
      response.writeHead(scenario === 'removal' ? 200 : 410);
      response.end();
      return;
    }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end(
        `<urlset><url><loc>${origin}/</loc></url>${scenario === 'draft' ? `<url><loc>${origin}/conteudos/rascunho</loc></url>` : ''}</urlset>`,
      );
      return;
    }
    if (request.url === '/robots.txt') {
      response.end(`User-agent: *\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(
      `<html><head><title>Fixture HTTP</title><link rel="canonical" href="${scenario === 'canonical' ? origin + '/outra' : origin + '/'}">${scenario === 'noindex' ? '<meta name="robots" content="noindex">' : ''}</head><body><h1>Fixture local</h1><input placeholder="Informe sua mensagem">${scenario === 'mock' ? '<p>Ilustração de demonstração</p>' : ''}</body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const localRequest: typeof fetch = (url, options) =>
    fetch(new URL(new URL(String(url)).pathname, `http://127.0.0.1:${address.port}`), options);
  try {
    assert.equal((await inspectCandidateHttp(origin, ['/'], ['/'], localRequest)).ready, true);
    const mappings = [
      {
        sourcePath: '/old',
        targetPath: '/',
        decision: 'redirect' as const,
        removalApproval: null,
        title: 'Fixture local',
        description: '',
        assetPaths: [],
      },
      {
        sourcePath: '/withdrawn',
        targetPath: null,
        decision: 'remove' as const,
        removalApproval: 'fixture/ref',
        title: 'Fixture local',
        description: '',
        assetPaths: [],
      },
    ];
    assert.equal(
      (await inspectCandidateHttp(origin, ['/'], ['/'], localRequest, ['/'], mappings)).ready,
      true,
    );
    for (const [value, code] of [
      ['redirect', 'REDIRECT_HTTP_MISMATCH'],
      ['removal', 'REMOVAL_HTTP_MISMATCH'],
    ]) {
      scenario = value!;
      const report = await inspectCandidateHttp(
        origin,
        ['/'],
        ['/'],
        localRequest,
        ['/'],
        mappings,
      );
      assert.ok(report.issues.some((issue) => issue.code === code));
    }
    scenario = 'clean';
    for (const [value, code] of [
      ['draft', 'SITEMAP_MISMATCH'],
      ['canonical', 'CANONICAL_MISMATCH'],
      ['noindex', 'PAGE_NOINDEX'],
      ['mock', 'PAGE_PLACEHOLDER'],
    ]) {
      scenario = value!;
      const report = await inspectCandidateHttp(origin, ['/'], ['/'], localRequest);
      assert.equal(report.ready, false);
      assert.ok(report.issues.some((issue) => issue.code === code));
    }
    await assert.rejects(inspectCandidateHttp('https://localhost', ['/'], ['/'], localRequest));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('controlled candidate stays non-indexable until cutover and detects crawler overrides', async () => {
  const origin = 'https://candidate.synthetic-release.org';
  let scenario = 'controlled';
  const server = createServer((request, response) => {
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end(
        `<urlset>${scenario === 'sitemap' ? `<url><loc>${origin}/</loc></url>` : ''}</urlset>`,
      );
    } else if (request.url === '/robots.txt') {
      response.end(
        scenario === 'crawler'
          ? 'User-agent: *\nAllow: /\nUser-agent: blocked\nDisallow: /\n'
          : scenario === 'override'
            ? 'User-agent: *\nDisallow: /\nAllow: /conteudos\n'
            : 'User-agent: *\nDisallow: /\n',
      );
    } else {
      response.setHeader('content-type', 'text/html');
      response.end(
        `<html><head><title>Candidata</title><link rel="canonical" href="${origin}/">${scenario === 'page' ? '' : '<meta name="robots" content="noindex,nofollow">'}</head><body><h1>Candidata</h1></body></html>`,
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const localRequest: typeof fetch = (url, options) =>
    fetch(new URL(new URL(String(url)).pathname, `http://127.0.0.1:${address.port}`), options);
  try {
    const check = () =>
      inspectCandidateHttp(origin, ['/'], ['/'], localRequest, ['/'], [], 'controlled');
    assert.deepEqual(await check(), { ready: true, phase: 'controlled', pages: 1, issues: [] });
    for (const [value, code] of [
      ['page', 'CONTROLLED_PAGE_INDEXABLE'],
      ['sitemap', 'SITEMAP_MISMATCH'],
      ['crawler', 'CONTROLLED_ROBOTS_UNPROTECTED'],
      ['override', 'CONTROLLED_ROBOTS_UNPROTECTED'],
    ]) {
      scenario = value!;
      const report = await check();
      assert.equal(report.ready, false);
      assert.ok(report.issues.some((issue) => issue.code === code));
    }
    scenario = 'controlled';
    assert.equal((await inspectCandidateHttp(origin, ['/'], ['/'], localRequest)).ready, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
