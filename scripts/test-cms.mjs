import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

// Requires built API and an existing Playwright/browser. Builds an isolated web artifact.
// Only resources
// created by this run are changed: a new DB, local storage and child processes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(root, 'apps/api');
const webRoot = resolve(root, 'apps/web');
const apiRequire = createRequire(resolve(apiRoot, 'package.json'));
const webRequire = createRequire(resolve(webRoot, 'package.json'));
const dotenv = apiRequire('dotenv');
dotenv.config({ path: resolve(apiRoot, '.env'), quiet: true });
dotenv.config({ path: resolve(webRoot, '.env.local'), quiet: true });
const { Client } = apiRequire('pg');
const httpOnly = process.argv.includes('--http-only');
const apiPort = Number(process.env.F6_TEST_API_PORT ?? 3025);
const webPort = Number(process.env.F6_TEST_WEB_PORT ?? 3024);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const id = randomUUID();
const buildPath = resolve(webRoot, `.local/f6-qa-build-${id}`);
const buildConfigPath = resolve(webRoot, `.local/f6-qa-tsconfig-${id}.json`);
const databaseName = `filaretti_f6_test_${id.replaceAll('-', '')}`;
const evidence = resolve(root, '.local/f6-qa-evidence');
const reportPath = resolve(root, '.local/f6-qa-smoke.json');
const storagePath = resolve(root, `.local/f6-qa-storage-${id}`);
const fixturePath = resolve(root, `.local/f6-qa-fixtures-${id}`);
const marker = `QA F6 ${id.slice(0, 8)}`;
const articleSlug = `qa-f6-${id}`;
const developmentPassword = 'Local-F2-Ficticio!2026';
const professionalId = '20000000-0000-4000-8000-000000000001';
const secretValues = Array.from({ length: 4 }, () => randomBytes(32).toString('hex'));
const sensitiveTokens = [];
const report = {
  startedAt: new Date().toISOString(),
  database: databaseName,
  server: { api: apiOrigin, web: webOrigin, optimized: true },
  checks: [],
  layouts: [],
  errors: [],
  cleanup: {},
  ownedProcesses: [],
  limitations: [
    'Only fictitious data, local PostgreSQL/storage/API and an optimized web build are exercised; external R2 and production are not validated.',
    'An existing browser/runtime is required; this script installs neither dependencies nor browsers.',
    'Viewport, keyboard and solid-text checks do not certify full WCAG, screen readers, physical devices or other engines.',
    'Worker multi-instance concurrency and stale-job leases are covered separately by PostgreSQL backend integration tests.',
  ],
};
let operator;
let database;
let browser;
let api;
let web;
let databaseCreated = false;
let directoriesCreated = false;
let buildCreated = false;
let baseUrl;
let environment;
let admin;
let author;
let articleId;
let media;
let uploadedRaster;
let browserContext;

function redact(value) {
  let result = String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, '[database]')
    .replace(/\/preview\/[^\s"'?<]+/giu, '/preview/[redacted]');
  for (const secret of [
    baseUrl?.password,
    baseUrl?.password ? decodeURIComponent(baseUrl.password) : '',
    ...secretValues,
    ...sensitiveTokens,
  ])
    if (secret) result = result.replaceAll(secret, '[redacted]');
  return result;
}

async function check(name, action) {
  console.log(`RUN ${name}`);
  try {
    const details = await action();
    report.checks.push({ name, passed: true, ...(details ? { details } : {}) });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = redact(
      error instanceof assert.AssertionError
        ? error.message
        : `${error?.name ?? 'Error'}: ${error?.message ?? 'check failed'}`,
    );
    report.checks.push({ name, passed: false, message });
    report.errors.push({ check: name, message });
    console.error(`FAIL ${name}: ${message}`);
  }
}

function child(command, args, cwd, env, label) {
  const process = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const running = { process, label, diagnostics: '' };
  if (process.pid) report.ownedProcesses.push({ label, pid: process.pid });
  const collect = (chunk) => {
    running.diagnostics = (running.diagnostics + chunk.toString()).slice(-32768);
  };
  process.stdout.on('data', collect);
  process.stderr.on('data', collect);
  process.on('error', () => {
    running.diagnostics += `\n${label} failed to start.`;
  });
  return running;
}

async function command(args, env, label) {
  const running = child(process.execPath, [process.env.npm_execpath, ...args], apiRoot, env, label);
  await new Promise((resolve, reject) => {
    running.process.once('error', () => reject(new Error(`${label} could not start`)));
    running.process.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} failed`)),
    );
  }).catch((error) => {
    console.error(redact(running.diagnostics));
    throw error;
  });
}

async function stop(running) {
  if (
    !running?.process.pid ||
    running.process.exitCode !== null ||
    running.process.signalCode !== null
  )
    return;
  const stopped = new Promise((resolve) => running.process.once('exit', resolve));
  if (process.platform === 'win32') {
    assert.ok(Number.isInteger(running.process.pid) && running.process.pid > 0);
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(running.process.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  } else running.process.kill('SIGTERM');
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (running.process.exitCode === null && running.process.signalCode === null)
    running.process.kill('SIGKILL');
}

async function freePort(port) {
  assert.ok(
    Number.isInteger(port) && port > 0 && port <= 65535 && ![3000, 3001].includes(port),
    'Only dedicated test ports may be used.',
  );
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Test port ${port} is occupied`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function ready(url, running) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (running.process.exitCode !== null) {
      console.error(redact(running.diagnostics));
      throw new Error(`${running.label} exited before readiness`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.arrayBuffer();
      if (response.status === 200) return;
    } catch {
      // Bound startup polling, including Next's first server render.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.error(redact(running.diagnostics));
  throw new Error(`${running.label} readiness timed out`);
}

async function request(url, expected = 200, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'manual',
    ...options,
  });
  const body = await response.text();
  assert.equal(response.status, expected, redact(`HTTP ${expected} for ${new URL(url).pathname}`));
  return { response, body };
}

class Session {
  cookies = new Map();
  csrfToken = '';
  async call(path, method = 'GET', body, expected = 200, extraHeaders = {}) {
    const multipart = body instanceof FormData;
    const { response, body: raw } = await request(`${apiOrigin}/api/v1${path}`, expected, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(method === 'GET' ? {} : { Origin: webOrigin, 'X-CSRF-Token': this.csrfToken }),
        ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const split = pair.indexOf('=');
      const key = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return raw ? JSON.parse(raw) : undefined;
  }
  async login(email) {
    this.csrfToken = (await this.call('/auth/csrf')).csrfToken;
    const result = await this.call('/auth/login', 'POST', {
      email,
      password: developmentPassword,
    });
    this.csrfToken = result.csrfToken;
  }
}

function document(value) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
  };
}

function png() {
  const width = 512;
  const height = 384;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const color = x + y < width ? [220, 234, 247] : [16, 42, 67];
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      for (let channel = 0; channel < 3; channel++) raw[offset + channel] = color[channel];
    }
  const crc32 = (data) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const bytes = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(bytes));
    return Buffer.concat([length, bytes, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function uploadForm(bytes, name, type, visibility = 'PUBLIC') {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  form.append('alt', `Imagem fictícia ${marker}`);
  form.append('source', 'Fixture local QA');
  form.append('license', 'Somente teste fictício');
  form.append('visibility', visibility);
  return form;
}

async function renderedAudit(page) {
  return page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden' &&
      getComputedStyle(element).display !== 'none';
    const parse = (value) => {
      const n = value.match(/[\d.]+/gu)?.map(Number);
      return n?.length >= 3 ? [n[0], n[1], n[2], n[3] ?? 1] : null;
    };
    const blend = (top, bottom) =>
      [0, 1, 2].map((n) => top[n] * top[3] + bottom[n] * (1 - top[3])).concat(1);
    const luminance = (rgb) =>
      rgb
        .slice(0, 3)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (element) => {
      const chain = [];
      for (let node = element; node; node = node.parentElement) chain.unshift(node);
      let result = [255, 255, 255, 1];
      for (const node of chain) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== 'none') return null;
        const color = parse(style.backgroundColor);
        if (color) result = blend(color, result);
      }
      return result;
    };
    const contrast = [];
    let textCount = 0;
    let ignoredText = 0;
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element) || element.closest('[aria-hidden="true"], [disabled],script,style'))
        continue;
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .trim();
      if (!text) continue;
      const bg = background(element);
      const color = parse(getComputedStyle(element).color);
      if (!bg || !color) {
        ignoredText++;
        continue;
      }
      textCount++;
      const a = luminance(blend(color, bg));
      const b = luminance(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 4.5) contrast.push({ text: text.slice(0, 80), ratio: Number(ratio.toFixed(3)) });
    }
    const fields = [
      ...document.querySelectorAll(
        'input:not([type="hidden"]),select,textarea,[contenteditable="true"]',
      ),
    ];
    const labels = fields
      .filter(visible)
      .filter(
        (field) =>
          !field.labels?.length &&
          !field.getAttribute('aria-label') &&
          !field.getAttribute('aria-labelledby'),
      )
      .map((field) => field.id || field.tagName);
    const buttons = [...document.querySelectorAll('button')]
      .filter(visible)
      .filter(
        (button) =>
          !button.textContent.trim() &&
          !button.getAttribute('aria-label') &&
          !button.getAttribute('aria-labelledby'),
      )
      .map((button) => button.outerHTML.slice(0, 120));
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    const duplicates = ids.filter((value, index) => ids.indexOf(value) !== index);
    const images = [...document.querySelectorAll('img')].filter(visible).map((image) => ({
      alt: image.getAttribute('alt'),
      complete: image.complete,
      naturalWidth: image.naturalWidth,
    }));
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1: [...document.querySelectorAll('h1')].map((heading) => heading.textContent),
      mains: document.querySelectorAll('main').length,
      labels,
      buttons,
      duplicates,
      contrast,
      textCount,
      ignoredText,
      images,
    };
  });
}

async function auditPage(page, name, width) {
  await page.evaluate(() => document.fonts.ready);
  const audit = await renderedAudit(page);
  await page.screenshot({ path: resolve(evidence, `${name}-${width}.png`), fullPage: true });
  report.layouts.push({ name, ...audit });
  assert.ok(
    audit.scrollWidth <= width,
    `${name} at ${width} has horizontal overflow ${audit.scrollWidth}`,
  );
  assert.equal(audit.h1.length, 1, `${name}: one main heading`);
  assert.equal(audit.mains, 1, `${name}: one main landmark`);
  assert.deepEqual(audit.labels, [], `${name}: fields have labels`);
  assert.deepEqual(audit.buttons, [], `${name}: buttons have accessible names`);
  assert.deepEqual(audit.duplicates, [], `${name}: unique IDs`);
  assert.deepEqual(audit.contrast, [], `${name}: text contrast`);
  for (const image of audit.images) {
    assert.notEqual(image.alt, null);
    assert.ok(image.complete && image.naturalWidth > 0, `${name}: rendered image loaded`);
  }
}

function fieldName(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escaped}(?: \\(obrigatório\\))?$`, 'u');
}

function startApi() {
  return child(
    process.execPath,
    [resolve(apiRoot, 'dist/main.js')],
    apiRoot,
    environment,
    'isolated CMS API',
  );
}

async function cleanup() {
  await browserContext?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  await stop(web);
  await stop(api);
  report.cleanup.processesStopped = [web, api].every(
    (running) =>
      !running || running.process.exitCode !== null || running.process.signalCode !== null,
  );
  await database?.end().catch(() => undefined);
  if (databaseCreated) {
    assert.match(databaseName, /^filaretti_f6_test_[a-f\d]{32}$/u);
    assert.notEqual(baseUrl.pathname, `/${databaseName}`);
    await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    report.cleanup.databaseRemoved =
      (await operator.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]))
        .rowCount === 0;
  }
  await operator?.end().catch(() => undefined);
  if (buildCreated) {
    assert.equal(buildPath, resolve(webRoot, `.local/f6-qa-build-${id}`));
    assert.ok(buildPath.startsWith(resolve(webRoot, '.local') + sep));
    rmSync(buildPath, { recursive: true, force: true });
    assert.equal(buildConfigPath, resolve(webRoot, `.local/f6-qa-tsconfig-${id}.json`));
    assert.ok(buildConfigPath.startsWith(resolve(webRoot, '.local') + sep));
    rmSync(buildConfigPath, { force: true });
    report.cleanup.buildRemoved = !existsSync(buildPath);
    report.cleanup.buildConfigRemoved = !existsSync(buildConfigPath);
  }
  if (directoriesCreated) {
    for (const [path, kind] of [
      [storagePath, 'storage'],
      [fixturePath, 'fixtures'],
    ]) {
      assert.equal(path, resolve(root, `.local/f6-qa-${kind}-${id}`));
      assert.ok(path.startsWith(resolve(root, '.local') + sep));
      rmSync(path, { recursive: true, force: true });
      report.cleanup[`${kind}Removed`] = !existsSync(path);
    }
  }
  await freePort(apiPort);
  await freePort(webPort);
  report.cleanup.portsReleased = true;
  assert.equal(report.cleanup.processesStopped, true, 'Owned children exited');
}

// Domain and browser flows are deliberately separate: UI assertions cannot
// replace backend authorization, byte validation or optimistic-write checks.
async function domainChecks() {
  await check('anonymous requests cannot enumerate CMS articles, media or previews', async () => {
    for (const path of ['/admin/articles', '/admin/media', '/admin/users']) {
      const result = await request(`${apiOrigin}/api/v1${path}`, 401);
      assert.match(result.response.headers.get('cache-control') ?? '', /no-store/iu);
      assert.doesNotMatch(result.body, /passwordHash|storageKey|createdById|postgres/iu);
    }
    await request(`${apiOrigin}/api/v1/preview/${'a'.repeat(64)}`, 404);
    await request(`${webOrigin}/preview/${'a'.repeat(64)}`, 404);
  });
  await check(
    'web forwarding and cache invalidation are restricted to their intended paths and secret',
    async () => {
      for (const path of ['public/articles', 'media/public/private.png', 'auth/..%2Fadmin'])
        await request(`${webOrigin}/api/cms/${path}`, 404);
      const body = JSON.stringify({ idempotencyKey: `qa-f6-${id}`, paths: ['/conteudos'] });
      await request(`${webOrigin}/api/revalidate`, 403, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Revalidation-Secret': secretValues[3],
      };
      for (const path of [
        '/admin',
        '/preview/private',
        'https://attacker.invalid',
        '/api/v1/articles',
      ])
        await request(`${webOrigin}/api/revalidate`, 400, {
          method: 'POST',
          headers,
          body: JSON.stringify({ idempotencyKey: `qa-f6-${id}`, paths: [path] }),
        });
      const valid = await request(`${webOrigin}/api/revalidate`, 200, {
        method: 'POST',
        headers,
        body,
      });
      assert.equal(JSON.parse(valid.body).revalidated, true);
      assert.match(valid.response.headers.get('cache-control') ?? '', /no-store/iu);
    },
  );
  await check('media upload enforces CSRF and the configured origin', async () => {
    await admin.call('/admin/media', 'POST', uploadForm(png(), 'fixture.png', 'image/png'), 403, {
      'X-CSRF-Token': '',
    });
    await admin.call('/admin/media', 'POST', uploadForm(png(), 'fixture.png', 'image/png'), 403, {
      Origin: 'https://attacker.invalid',
    });
  });
  await check(
    'upload rejects executable files, extension/MIME mismatch and image limits',
    async () => {
      const before = Number((await database.query('SELECT COUNT(*) FROM media')).rows[0].count);
      for (const [bytes, name, type, status = 400] of [
        [
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
          'attack.svg',
          'image/svg+xml',
        ],
        [Buffer.from('<html><script>alert(1)</script></html>'), 'attack.html', 'text/html'],
        [png(), 'attack.pdf', 'application/pdf'],
        [Buffer.from('fake raster'), 'fake.png', 'image/png'],
        [Buffer.concat([png(), Buffer.alloc(5 * 1024 * 1024)]), 'large.png', 'image/png', 413],
      ]) {
        const error = await admin.call(
          '/admin/media',
          'POST',
          uploadForm(bytes, name, type),
          status,
        );
        assert.ok(
          ['INVALID_MEDIA', 'MEDIA_INVALID', 'INVALID_REQUEST', 'PAYLOAD_TOO_LARGE'].includes(
            error.error.code,
          ),
        );
      }
      assert.equal(
        Number((await database.query('SELECT COUNT(*) FROM media')).rows[0].count),
        before,
      );
      return { rejectedUploads: 5 };
    },
  );
  await check(
    'valid upload persists random storage identity and serves exact raster through web facade',
    async () => {
      media = await admin.call(
        '/admin/media',
        'POST',
        uploadForm(png(), 'client-controlled-name.png', 'image/png'),
        201,
      );
      assert.match(media.url, /^\/media\/public\/[a-f\d-]{36}\.png$/u);
      assert.ok(!media.url.includes('client-controlled-name'));
      assert.equal(media.mimeType, 'image/png');
      assert.ok(media.size > 0 && media.size <= 5 * 1024 * 1024);
      assert.equal(media.version, 1);
      assert.ok(!('storageKey' in media));
      const response = await fetch(`${webOrigin}${media.url}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /^image\/png/iu);
      assert.match(response.headers.get('x-content-type-options') ?? '', /nosniff/iu);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
      uploadedRaster = Buffer.from(await response.arrayBuffer());
      assert.equal(uploadedRaster.length, media.size);
      const metadata = await apiRequire('sharp')(uploadedRaster).metadata();
      assert.equal(metadata.width, 512);
      assert.equal(metadata.height, 384);
      assert.equal(metadata.format, 'png');
      const optimized = await fetch(
        `${webOrigin}/_next/image?url=${encodeURIComponent(media.url)}&w=256&q=75`,
      );
      assert.equal(optimized.status, 400);
      assert.match(optimized.headers.get('cache-control') ?? '', /no-store/iu);
      await optimized.arrayBuffer();
      return { persistedBytes: media.size, randomKey: true, optimizerCacheBlocked: true };
    },
  );
  await check('deleted CMS media cannot survive through the image optimizer cache', async () => {
    const disposable = await admin.call(
      '/admin/media',
      'POST',
      uploadForm(png(), 'revocable-fixture.png', 'image/png'),
      201,
    );
    await request(`${webOrigin}${disposable.url}`);
    const optimizerPath = `/_next/image?url=${encodeURIComponent(disposable.url)}&w=256&q=75`;
    await request(`${webOrigin}${optimizerPath}`, 400);
    await admin.call(`/admin/media/${disposable.id}`, 'DELETE', { version: disposable.version });
    await request(`${webOrigin}${disposable.url}`, 404);
    await request(`${webOrigin}${optimizerPath}`, 400);
    const encodedPath = disposable.url.replace('/media/', '/%6dedia/');
    await request(
      `${webOrigin}/_next/image?url=${encodeURIComponent(encodedPath)}&w=256&q=75`,
      400,
    );
    for (const variant of [
      disposable.url.replace('/public/', '/public/temporary/../'),
      disposable.url.replace('/public/', '/public%2Ftemporary%2F..%2F'),
      `${disposable.url}?variant=revoked`,
      `${disposable.url}#revoked`,
    ])
      await request(`${webOrigin}/_next/image?url=${encodeURIComponent(variant)}&w=256&q=75`, 400);
  });
  await check(
    'PDF upload accepts a real document, serves an attachment and rejects active actions',
    async () => {
      const { PDFDocument, PDFName, PDFString } = apiRequire('pdf-lib');
      const pdf = await PDFDocument.create();
      pdf.addPage([300, 200]).drawText('F6 fictitious QA document');
      const bytes = await pdf.save({ useObjectStreams: false });
      const item = await admin.call(
        '/admin/media',
        'POST',
        uploadForm(bytes, 'guide-fixture.pdf', 'application/pdf'),
        201,
      );
      assert.match(item.url, /^\/media\/public\/[a-f\d-]{36}\.pdf$/u);
      const response = await fetch(`${webOrigin}${item.url}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /^application\/pdf/iu);
      assert.match(response.headers.get('content-disposition') ?? '', /^attachment/iu);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(bytes));
      pdf.catalog.set(
        PDFName.of('OpenAction'),
        pdf.context.obj({ S: PDFName.of('JavaScript'), JS: PDFString.of('app.alert(1)') }),
      );
      const active = await pdf.save({ useObjectStreams: false });
      const rejected = await admin.call(
        '/admin/media',
        'POST',
        uploadForm(active, 'active.pdf', 'application/pdf'),
        400,
      );
      assert.equal(rejected.error.code, 'INVALID_MEDIA');
      await admin.call(
        '/admin/media',
        'POST',
        uploadForm(Buffer.alloc(10 * 1024 * 1024 + 1), 'large.pdf', 'application/pdf'),
        413,
      );
      return {
        validDocumentBytes: bytes.length,
        activeActionRejected: true,
        downloadAttachment: true,
      };
    },
  );
  await check(
    'private assets and guessed traversal paths are never publicly downloadable',
    async () => {
      const privateMedia = await admin.call(
        '/admin/media',
        'POST',
        uploadForm(png(), 'private.png', 'image/png', 'PRIVATE'),
        201,
      );
      assert.equal(privateMedia.url, null);
      const row = (
        await database.query('SELECT storage_key FROM media WHERE id=$1', [privateMedia.id])
      ).rows[0];
      await request(`${apiOrigin}/api/v1/media/public/${row.storage_key}`, 404);
      await request(`${webOrigin}/media/public/${row.storage_key}`, 404);
      for (const key of ['not-owned.png', '..%2Fprivate.png', 'fixture.svg'])
        await request(`${apiOrigin}/api/v1/media/public/${key}`, 404);
      const found = await author.call('/admin/media');
      assert.ok(
        !found.data.some((record) => record.id === privateMedia.id || record.id === media.id),
      );
      await author.call(`/admin/media/${media.id}`, 'GET', undefined, 403);
    },
  );
  await check('media search and stale metadata edits protect the library', async () => {
    const found = await admin.call(`/admin/media?q=${encodeURIComponent(marker)}&kind=image`);
    assert.ok(found.data.some((record) => record.id === media.id));
    const fresh = await admin.call(`/admin/media/${media.id}`, 'PATCH', {
      version: media.version,
      alt: `Capa fictícia ${marker}`,
    });
    assert.equal(fresh.version, media.version + 1);
    const stale = await admin.call(
      `/admin/media/${media.id}`,
      'PATCH',
      { version: media.version, alt: 'Overwrite forbidden' },
      409,
    );
    assert.equal(stale.error.code, 'VERSION_CONFLICT');
    media = fresh;
  });
  await check(
    'AUTHOR can create and preview their own draft but cannot publish or edit another owner',
    async () => {
      const item = await author.call(
        '/admin/articles',
        'POST',
        {
          title: `Rascunho AUTHOR ${marker}`,
          slug: `author-${articleSlug}`,
          excerpt: 'Conteúdo fictício para verificar permissões.',
          content: document('Rascunho fictício pertencente a AUTHOR.'),
          type: 'ARTICLE',
          authorId: professionalId,
        },
        201,
      );
      await author.call(
        `/admin/articles/${item.id}/publication`,
        'POST',
        { version: item.version, status: 'PUBLISHED' },
        403,
      );
      const preview = await author.call(
        `/admin/articles/${item.id}/preview`,
        'POST',
        { version: item.version },
        201,
      );
      sensitiveTokens.push(preview.token);
      const response = await request(`${apiOrigin}/api/v1/preview/${preview.token}`);
      assert.match(response.response.headers.get('cache-control') ?? '', /no-store/iu);
      assert.equal(JSON.parse(response.body).article.id, item.id);
      const other = (await admin.call('/admin/articles')).data.find(
        (record) => record.createdById !== item.createdById,
      );
      assert.ok(other, 'Seed has a draft owned by another administrative identity');
      await author.call(
        `/admin/articles/${other.id}`,
        'PATCH',
        { version: other.version, title: 'Forbidden change' },
        403,
      );
      await author.call(
        `/admin/articles/${other.id}/preview`,
        'POST',
        { version: other.version },
        403,
      );
      const empty = await request(`${apiOrigin}/api/v1/articles/${item.slug}`, 404);
      assert.ok(!empty.body.includes(item.title));
      await author.call(`/admin/articles/${item.id}/preview`, 'DELETE', { version: item.version });
      await request(`${apiOrigin}/api/v1/preview/${preview.token}`, 404);
    },
  );
  await check('backend rejects executable rich documents and past schedules', async () => {
    const item = await admin.call(
      '/admin/articles',
      'POST',
      {
        title: `Validação ${marker}`,
        slug: `validation-${articleSlug}`,
        excerpt: 'Rascunho exclusivamente fictício.',
        content: document('Texto fictício válido.'),
        type: 'ARTICLE',
        authorId: professionalId,
      },
      201,
    );
    for (const content of [
      { type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://attacker.invalid' } }] },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'unsafe',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
    ])
      await admin.call(
        `/admin/articles/${item.id}`,
        'PATCH',
        { version: item.version, content },
        400,
      );
    await admin.call(
      `/admin/articles/${item.id}/publication`,
      'POST',
      {
        version: item.version,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60000).toISOString(),
      },
      400,
    );
    const original = await admin.call(`/admin/articles/${item.id}`);
    assert.equal(original.version, item.version);
    assert.equal(original.status, 'DRAFT');
  });
  await check(
    'redirect management rejects external targets, reserved destinations and loops',
    async () => {
      for (const targetPath of [
        'https://attacker.invalid',
        '/admin/login',
        '/preview/secret',
        '/api/v1/auth/me',
      ])
        await admin.call(
          '/admin/redirects',
          'POST',
          { sourcePath: `/qa-f6-${id.slice(0, 8)}`, targetPath },
          400,
        );
      const first = await admin.call(
        '/admin/redirects',
        'POST',
        { sourcePath: `/qa-f6-a-${id.slice(0, 8)}`, targetPath: `/qa-f6-b-${id.slice(0, 8)}` },
        201,
      );
      await admin.call(
        '/admin/redirects',
        'POST',
        { sourcePath: first.targetPath, targetPath: first.sourcePath },
        400,
      );
      const legacy = await admin.call(
        '/admin/redirects',
        'POST',
        { sourcePath: `/qa-f6-legacy-${id}.html`, targetPath: '/conteudos' },
        201,
      );
      const redirected = await request(`${webOrigin}${legacy.sourcePath}`, 301);
      assert.equal(
        new URL(redirected.response.headers.get('location'), webOrigin).pathname,
        '/conteudos',
      );
    },
  );
  if (browser) await browserFlow();
  await check(
    'a published slug change preserves the prior URL and reserves it against reuse',
    async () => {
      const item = await admin.call(
        '/admin/articles',
        'POST',
        {
          title: `Slug fictício ${marker}`,
          slug: `old-${articleSlug}`,
          excerpt: 'Fixture fictícia de preservação de URL.',
          content: document('Conteúdo fictício para testar uma mudança de slug.'),
          type: 'ARTICLE',
          authorId: professionalId,
        },
        201,
      );
      const published = await admin.call(
        `/admin/articles/${item.id}/publication`,
        'POST',
        { version: item.version, status: 'PUBLISHED' },
        201,
      );
      const changed = await admin.call(`/admin/articles/${item.id}`, 'PATCH', {
        version: published.version,
        slug: `changed-${articleSlug}`,
      });
      assert.equal(changed.status, 'PUBLISHED');
      const prior = await request(`${webOrigin}/conteudos/${item.slug}`, 301);
      assert.equal(
        new URL(prior.response.headers.get('location'), webOrigin).pathname,
        `/conteudos/${changed.slug}`,
      );
      assert.ok(
        (await request(`${webOrigin}/conteudos/${changed.slug}`)).body.includes(item.title),
      );
      const collision = await admin.call(
        '/admin/articles',
        'POST',
        {
          title: 'Fictitious reserved slug',
          slug: item.slug,
          excerpt: 'Fictitious collision.',
          content: document('Fictitious fixture.'),
          type: 'ARTICLE',
          authorId: professionalId,
        },
        400,
      );
      assert.equal(collision.error.code, 'SLUG_RESERVED');
    },
  );
  await check(
    'overdue scheduled publication is recovered by an actual API process restart',
    async () => {
      const item = await admin.call(
        '/admin/articles',
        'POST',
        {
          title: `Agendamento após reinício ${marker}`,
          slug: `restart-${articleSlug}`,
          excerpt: 'Fixture fictícia de recuperação após reinício.',
          content: document('Conteúdo fictício agendado e recuperado pelo worker real.'),
          type: 'ARTICLE',
          authorId: professionalId,
        },
        201,
      );
      const scheduled = await admin.call(
        `/admin/articles/${item.id}/publication`,
        'POST',
        {
          version: item.version,
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
        },
        201,
      );
      assert.equal(scheduled.status, 'SCHEDULED');
      await request(`${apiOrigin}/api/v1/articles/${item.slug}`, 404);
      await stop(api);
      api = undefined;
      // Advance this owned fixture's clock while the process is down. This avoids
      // sleeping a minute and proves recovery from persistent overdue DB state.
      await database.query(
        "UPDATE articles SET scheduled_at=NOW()-INTERVAL '1 second' WHERE id=$1 AND status='SCHEDULED'",
        [item.id],
      );
      api = startApi();
      await ready(`${apiOrigin}/health`, api);
      let recovered;
      for (let attempt = 0; attempt < 50; attempt++) {
        recovered = await admin.call(`/admin/articles/${item.id}`);
        if (recovered.status === 'PUBLISHED') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(recovered.status, 'PUBLISHED');
      assert.equal(recovered.version, scheduled.version + 1);
      assert.equal(
        (
          await database.query(
            "SELECT COUNT(*) FROM audit_events WHERE resource_id=$1 AND action='article.scheduled.published'",
            [item.id],
          )
        ).rows[0].count,
        '1',
      );
      const publicRead = await request(`${webOrigin}/conteudos/${item.slug}`);
      assert.ok(publicRead.body.includes(item.title));
      const tasks = await database.query(
        "SELECT topic,status,payload FROM outbox_tasks WHERE topic='cache.revalidate' AND payload::text LIKE $1",
        [`%${item.slug}%`],
      );
      assert.ok(tasks.rows.length > 0, 'Scheduled publication persisted invalidation');
      for (let attempt = 0; attempt < 50; attempt++) {
        const pending = await database.query(
          "SELECT COUNT(*) FROM outbox_tasks WHERE topic='cache.revalidate' AND payload::text LIKE $1 AND status!='COMPLETED'",
          [`%${item.slug}%`],
        );
        if (pending.rows[0].count === '0') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const completed = await database.query(
        "SELECT COUNT(*) FROM outbox_tasks WHERE topic='cache.revalidate' AND payload::text LIKE $1 AND status='COMPLETED'",
        [`%${item.slug}%`],
      );
      assert.ok(
        Number(completed.rows[0].count) > 0,
        'Real Next revalidation acknowledged the worker delivery',
      );
      return {
        overdueRecovery: true,
        processRestart: true,
        publicationEvents: 1,
        persistedInvalidationAcknowledged: true,
      };
    },
  );
  await check('API restart preserves media and committed CMS mutations', async () => {
    await stop(api);
    api = startApi();
    await ready(`${apiOrigin}/health`, api);
    const stored = await admin.call(`/admin/media/${media.id}`);
    assert.equal(stored.alt, media.alt);
    const response = await fetch(`${webOrigin}${stored.url}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), uploadedRaster);
    if (articleId) {
      const item = await admin.call(`/admin/articles/${articleId}`);
      assert.equal(item.slug, articleSlug);
      assert.equal(item.status, 'DRAFT');
      await request(`${webOrigin}/conteudos/${articleSlug}`, 404);
    }
  });
}

async function browserFlow() {
  browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  browserContext.setDefaultTimeout(10000);
  const page = await browserContext.newPage();
  const diagnostics = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => diagnostics.push(redact(error.message)));
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push({
        text: redact(message.text()),
        location: redact(message.location().url),
      });
  });
  await check(
    'login fields, keyboard submission and HttpOnly session work through the web BFF',
    async () => {
      await page.goto(`${webOrigin}/admin/login`, { waitUntil: 'networkidle' });
      for (const width of [375, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await auditPage(page, 'login', width);
      }
      await page.getByLabel(fieldName('E-mail')).fill('admin@filaretti.test');
      await page.getByLabel(fieldName('Senha')).fill(developmentPassword);
      await page.getByRole('button', { name: 'Entrar', exact: true }).focus();
      await Promise.all([page.waitForURL(`${webOrigin}/admin`), page.keyboard.press('Enter')]);
      await page.getByRole('heading', { level: 1 }).waitFor();
      const cookies = await browserContext.cookies();
      for (const name of ['filaretti_access', 'filaretti_refresh']) {
        const cookie = cookies.find((entry) => entry.name === name);
        assert.ok(cookie?.httpOnly, `${name} is HttpOnly`);
      }
      const leaked = await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }));
      assert.deepEqual(leaked, { local: {}, session: {} });
    },
  );
  await check('UI creates a draft with TipTap text, SEO fields and an uploaded cover', async () => {
    await page.goto(`${webOrigin}/admin/artigos/novo`, { waitUntil: 'networkidle' });
    await page.getByLabel(fieldName('Título')).fill(`${marker} — artigo fictício no CMS`);
    await page.getByLabel(fieldName('Slug')).fill(articleSlug);
    await page
      .getByLabel(fieldName('Resumo'))
      .fill('Resumo fictício criado pelo fluxo completo do CMS.');
    await page.getByLabel(fieldName('Autor profissional')).selectOption(professionalId);
    await page.getByLabel(fieldName('Tipo')).selectOption('ARTICLE');
    await page
      .getByRole('textbox', { name: 'Conteúdo', exact: true })
      .fill(
        `Conteúdo fictício criado no TipTap. ${marker}. <script>globalThis.__f6_xss=1</script>`,
      );
    const seoTitle = page.getByLabel(fieldName('Título SEO'));
    if (await seoTitle.count()) await seoTitle.fill(`SEO fictício ${marker}`);
    const seoDescription = page.getByLabel(fieldName('Descrição SEO'));
    if (await seoDescription.count())
      await seoDescription.fill('Descrição exclusivamente fictícia para verificar o CMS.');
    const cover = page.locator('fieldset.cms-media-picker').first();
    await cover.locator('summary').click();
    await cover.locator('input[type=file]').setInputFiles(resolve(fixturePath, 'cover.png'));
    await cover.getByLabel(fieldName('Texto alternativo')).fill(`Capa enviada no editor ${marker}`);
    await cover.getByRole('button', { name: 'Enviar arquivo', exact: true }).click();
    await page.waitForFunction(() => {
      const field = document.querySelector('fieldset.cms-media-picker select');
      return Boolean(field?.value);
    });
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await page.waitForURL(/\/admin\/artigos\/[a-f\d-]{36}$/u);
    articleId = page.url().split('/').at(-1);
    const record = await admin.call(`/admin/articles/${articleId}`);
    assert.equal(record.slug, articleSlug);
    assert.equal(record.status, 'DRAFT');
    assert.ok(record.coverMediaId);
    assert.ok(JSON.stringify(record.content).includes(marker));
    await request(`${apiOrigin}/api/v1/articles/${articleSlug}`, 404);
    await request(`${webOrigin}/conteudos/${articleSlug}`, 404);
    for (const width of [375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await auditPage(page, 'article-editor', width);
    }
    return { createdByBrowser: true, uploadedCover: true, draftHidden: true };
  });
  await check(
    'expiring preview reuses safe renderer with noindex, no-store and revocation',
    async () => {
      await page.getByRole('button', { name: 'Gerar preview', exact: true }).click();
      const link = page.getByRole('link', { name: /^Abrir preview/u });
      await link.waitFor();
      const previewHref = await link.getAttribute('href');
      const previewUrl = new URL(previewHref, webOrigin);
      const token = previewUrl.pathname.split('/').at(-1);
      sensitiveTokens.push(token);
      const result = await request(previewUrl.href);
      assert.match(result.response.headers.get('cache-control') ?? '', /no-store/iu);
      assert.match(result.body, /noindex/iu);
      assert.ok(result.body.includes(marker));
      const previewPage = await browserContext.newPage();
      try {
        await previewPage.goto(previewUrl.href, { waitUntil: 'networkidle' });
        assert.equal(await previewPage.evaluate(() => globalThis.__f6_xss), undefined);
        assert.ok(
          (await previewPage.locator('main').innerText()).includes(
            '<script>globalThis.__f6_xss=1</script>',
          ),
        );
        for (const width of [375, 768, 1024, 1440, 1920]) {
          await previewPage.setViewportSize({ width, height: 1000 });
          await auditPage(previewPage, 'preview', width);
        }
      } finally {
        await previewPage.close();
      }
      const item = await admin.call(`/admin/articles/${articleId}`);
      await admin.call(`/admin/articles/${articleId}/preview`, 'DELETE', { version: item.version });
      await request(previewUrl.href, 404);
      const regenerated = await admin.call(
        `/admin/articles/${articleId}/preview`,
        'POST',
        { version: item.version },
        201,
      );
      sensitiveTokens.push(regenerated.token);
      await database.query(
        "UPDATE preview_tokens SET expires_at=NOW()-INTERVAL '1 second' WHERE article_id=$1 AND revoked_at IS NULL",
        [articleId],
      );
      await request(`${apiOrigin}/api/v1/preview/${regenerated.token}`, 404);
      return { revokedRejected: true, expiredRejected: true, escapedText: true };
    },
  );
  await check(
    'the rich editor is read-only while a save is in flight and becomes editable afterward',
    async () => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const matcher = `${webOrigin}/api/cms/admin/articles/${articleId}`;
      await page.route(matcher, async (route) => {
        if (route.request().method() === 'PATCH') await gate;
        await route.continue();
      });
      try {
        await page.getByLabel(fieldName('Título')).fill(`${marker} — artigo fictício salvo`);
        await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[role="textbox"][aria-label="Conteúdo"]')
              ?.getAttribute('contenteditable') === 'false',
        );
        release();
        await page.getByRole('status').filter({ hasText: 'Alterações salvas.' }).waitFor();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[role="textbox"][aria-label="Conteúdo"]')
              ?.getAttribute('contenteditable') === 'true',
        );
      } finally {
        release();
        await page.unroute(matcher);
      }
    },
  );
  await check('UI detects an optimistic edit conflict and preserves the unsaved text', async () => {
    const item = await admin.call(`/admin/articles/${articleId}`);
    await admin.call(`/admin/articles/${articleId}`, 'PATCH', {
      version: item.version,
      excerpt: 'Mudança fictícia feita por outro editor.',
    });
    await page.getByLabel(fieldName('Título')).fill(`${marker} — texto local preservado`);
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: /alterado por outra pessoa/iu })
      .waitFor();
    assert.equal(
      await page.getByLabel(fieldName('Título')).inputValue(),
      `${marker} — texto local preservado`,
    );
    assert.notEqual(
      (await admin.call(`/admin/articles/${articleId}`)).title,
      `${marker} — texto local preservado`,
    );
    await page.screenshot({ path: resolve(evidence, 'conflict-mobile.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle' });
  });
  await check(
    'UI publication appears on public reading, home and relations on the next request',
    async () => {
      await page.getByRole('button', { name: 'Publicar', exact: true }).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('main *')].some(
          (element) => element.textContent === 'Publicado',
        ),
      );
      const item = await admin.call(`/admin/articles/${articleId}`);
      assert.equal(item.status, 'PUBLISHED');
      const result = await request(`${webOrigin}/conteudos/${articleSlug}`);
      assert.match(result.response.headers.get('cache-control') ?? '', /no-store/iu);
      assert.ok(result.body.includes(marker));
      const reading = await browserContext.newPage();
      try {
        await reading.goto(`${webOrigin}/conteudos/${articleSlug}`, { waitUntil: 'networkidle' });
        assert.equal(await reading.evaluate(() => globalThis.__f6_xss), undefined);
        assert.ok((await reading.locator('main').innerText()).includes(marker));
        const liveCover = await admin.call(`/admin/media/${item.coverMediaId}`);
        assert.equal(
          new URL(
            await reading.locator('figure.editorial-cover img').getAttribute('src'),
            webOrigin,
          ).pathname,
          liveCover.url,
        );
        for (const width of [375, 768, 1024, 1440, 1920]) {
          await reading.setViewportSize({ width, height: 1000 });
          await auditPage(reading, 'public-reading', width);
        }
      } finally {
        await reading.close();
      }
      assert.ok((await request(webOrigin)).body.includes(`/conteudos/${articleSlug}`));
      assert.ok(
        (await request(`${webOrigin}/profissionais/profissional-ficticio-1`)).body.includes(
          `/conteudos/${articleSlug}`,
        ),
      );
      assert.ok(
        (await request(`${webOrigin}/conteudos`)).body.includes(`/conteudos/${articleSlug}`),
      );
      const cover = await admin.call(`/admin/media/${item.coverMediaId}`);
      const error = await admin.call(
        `/admin/media/${cover.id}`,
        'DELETE',
        { version: cover.version },
        409,
      );
      assert.equal(error.error.code, 'RESOURCE_IN_USE');
    },
  );
  await check(
    'UI withdrawal removes the article and every checked public dependency without rebuild',
    async () => {
      const start = performance.now();
      await page.getByRole('button', { name: 'Retirar de publicação', exact: true }).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('main *')].some(
          (element) => element.textContent === 'Rascunho',
        ),
      );
      await request(`${apiOrigin}/api/v1/articles/${articleSlug}`, 404);
      await request(`${webOrigin}/conteudos/${articleSlug}`, 404);
      for (const path of ['/', '/conteudos', '/profissionais/profissional-ficticio-1'])
        assert.ok(
          !(await request(`${webOrigin}${path}`)).body.includes(`/conteudos/${articleSlug}`),
        );
      return { elapsedMilliseconds: Math.round(performance.now() - start), dependentRoutes: 3 };
    },
  );
  await check(
    'all CMS list/dashboard surfaces are labelled and fit five viewport widths',
    async () => {
      const failures = [];
      for (const [name, path] of [
        ['dashboard', '/admin'],
        ['article-list', '/admin/artigos'],
        ['categories', '/admin/categorias'],
        ['tags', '/admin/tags'],
        ['areas', '/admin/areas'],
        ['professionals', '/admin/profissionais'],
        ['pages', '/admin/paginas'],
        ['faq', '/admin/faq'],
        ['media-library', '/admin/midia'],
        ['settings', '/admin/configuracoes'],
        ['redirects', '/admin/redirects'],
        ['users', '/admin/usuarios'],
      ]) {
        await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1 }).waitFor();
        for (const width of [375, 768, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 1000 });
          try {
            await auditPage(page, name, width);
          } catch (error) {
            failures.push(redact(error.message));
          }
        }
      }
      assert.deepEqual(failures, []);
      return { surfaces: 12, widths: 5 };
    },
  );
  await check(
    'AUTHOR UI exposes own drafts while hiding publication and ADMIN navigation',
    async () => {
      const context = await browser.newContext({ viewport: { width: 375, height: 1000 } });
      const authorPage = await context.newPage();
      try {
        await authorPage.goto(`${webOrigin}/admin/login`, { waitUntil: 'networkidle' });
        await authorPage.getByLabel(fieldName('E-mail')).fill('author@filaretti.test');
        await authorPage.getByLabel(fieldName('Senha')).fill(developmentPassword);
        await authorPage.getByRole('button', { name: 'Entrar', exact: true }).click();
        await authorPage.waitForURL(`${webOrigin}/admin`);
        await authorPage.goto(`${webOrigin}/admin/artigos/novo`, { waitUntil: 'networkidle' });
        await authorPage.getByRole('textbox', { name: 'Conteúdo', exact: true }).waitFor();
        await authorPage.getByLabel(fieldName('Título')).fill(`AUTHOR browser ${marker}`);
        await authorPage.getByLabel(fieldName('Slug')).fill(`author-browser-${articleSlug}`);
        await authorPage
          .getByLabel(fieldName('Resumo'))
          .fill('Rascunho fictício criado por AUTHOR na interface.');
        await authorPage.getByLabel(fieldName('Autor profissional')).selectOption(professionalId);
        await authorPage
          .getByRole('textbox', { name: 'Conteúdo', exact: true })
          .fill('Conteúdo fictício de AUTHOR para testar opções e criação no navegador.');
        await authorPage.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
        await authorPage.waitForURL(/\/admin\/artigos\/[a-f\d-]{36}$/u);
        assert.equal(
          await authorPage.getByRole('button', { name: 'Publicar', exact: true }).count(),
          0,
        );
        assert.equal(
          await authorPage.getByRole('button', { name: 'Agendar', exact: true }).count(),
          0,
        );
        assert.equal(
          await authorPage.getByRole('link', { name: 'Usuários', exact: true }).count(),
          0,
        );
        assert.equal(
          await authorPage.getByRole('link', { name: 'Configurações', exact: true }).count(),
          0,
        );
        await auditPage(authorPage, 'author-editor', 375);
        await authorPage.getByRole('button', { name: 'Gerar preview', exact: true }).click();
        const previewLink = authorPage.getByRole('link', { name: /^Abrir preview/u });
        await previewLink.waitFor();
        const href = new URL(await previewLink.getAttribute('href'), webOrigin);
        sensitiveTokens.push(href.pathname.split('/').at(-1));
        const preview = await request(href.href);
        assert.ok(preview.body.includes(`AUTHOR browser ${marker}`));
        const own = (await author.call('/admin/articles')).data.find(
          (item) => item.slug === `author-browser-${articleSlug}`,
        );
        assert.ok(own && own.status === 'DRAFT');
        await authorPage.goto(`${webOrigin}/admin/usuarios`, { waitUntil: 'networkidle' });
        await authorPage
          .getByText(/permissão/iu)
          .first()
          .waitFor();
        assert.equal(
          await authorPage.getByText('Administração Filaretti', { exact: true }).count(),
          0,
        );
      } finally {
        await context.close();
      }
    },
  );
  await check(
    'CMS browser completed without unhandled errors and logout revokes the session',
    async () => {
      assert.deepEqual(diagnostics, []);
      const expectedConsole = consoleErrors.filter(
        (entry) =>
          /Failed to load resource/iu.test(entry.text) &&
          ((/\b401\b/u.test(entry.text) &&
            /\/api\/cms\/auth\/(?:me|refresh)$/u.test(entry.location)) ||
            (/\b409\b/u.test(entry.text) &&
              entry.location.endsWith(`/api/cms/admin/articles/${articleId}`))),
      );
      assert.deepEqual(
        consoleErrors.filter((entry) => !expectedConsole.includes(entry)),
        [],
      );
      await page.getByRole('button', { name: 'Sair', exact: true }).click();
      await page.waitForURL(`${webOrigin}/admin/login`);
      const response = await page.request.get(`${webOrigin}/api/cms/auth/me`);
      assert.equal(response.status(), 401);
      return {
        unhandledErrors: 0,
        unexpectedConsoleErrors: 0,
        expectedRejectedRequests: expectedConsole.length,
      };
    },
  );
  await page.close();
}

try {
  if (process.env.APP_ENV !== 'development') throw new Error('Require APP_ENV=development');
  if (!process.env.DATABASE_URL || !process.env.npm_execpath)
    throw new Error('Run through pnpm with a configured local DATABASE_URL');
  baseUrl = new URL(process.env.DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(baseUrl.protocol));
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname),
    'Only loopback PostgreSQL is allowed',
  );
  assert.ok(
    existsSync(resolve(apiRoot, 'dist/main.js')) && existsSync(resolve(webRoot, '.next/BUILD_ID')),
    'Build API and web before running',
  );
  assert.notEqual(apiPort, webPort);
  await freePort(apiPort);
  await freePort(webPort);
  if (!httpOnly) {
    let playwright;
    try {
      playwright = process.env.PLAYWRIGHT_MODULE_PATH
        ? apiRequire(process.env.PLAYWRIGHT_MODULE_PATH)
        : webRequire('playwright');
    } catch {
      throw new Error(
        'Playwright unavailable: supply PLAYWRIGHT_MODULE_PATH to an existing module, or explicitly use --http-only. No browser is installed.',
      );
    }
    browser = await playwright.chromium.launch({
      channel: process.env.F6_TEST_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    report.browser = {
      channel: process.env.F6_TEST_BROWSER_CHANNEL ?? 'msedge',
      version: browser.version(),
    };
  } else
    report.limitations.push(
      'Explicit --http-only: browser, keyboard, screenshots and viewport checks were not executed.',
    );
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${databaseName}`;
  environment = {
    ...process.env,
    DATABASE_URL: testUrl.href,
    NODE_ENV: 'development',
    APP_ENV: 'development',
    MOCK_CONTENT: 'true',
    API_HOST: '127.0.0.1',
    API_PORT: String(apiPort),
    WEB_PUBLIC_URL: webOrigin,
    API_PUBLIC_URL: apiOrigin,
    API_INTERNAL_URL: apiOrigin,
    FILARETTI_QA_BUILD_ID: id,
    JWT_SECRET: secretValues[0],
    REFRESH_TOKEN_SECRET: secretValues[1],
    PREVIEW_SECRET: secretValues[2],
    REVALIDATION_SECRET: secretValues[3],
    COOKIE_SECURE: 'false',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_PATH: storagePath,
    CMS_WORKER_ENABLED: 'true',
    R2_ENABLED: 'false',
    RESEND_ENABLED: 'false',
    TURNSTILE_ENABLED: 'false',
  };
  mkdirSync(evidence, { recursive: true });
  mkdirSync(storagePath, { recursive: false });
  mkdirSync(fixturePath, { recursive: false });
  directoriesCreated = true;
  writeFileSync(resolve(fixturePath, 'cover.png'), png(), { flag: 'wx' });
  operator = new Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
  await operator.connect();
  await operator.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  await command(['exec', 'prisma', 'migrate', 'deploy'], environment, 'isolated CMS migrations');
  await command(
    ['exec', 'tsx', 'prisma/seed-development.ts'],
    environment,
    'isolated fictitious CMS seed',
  );
  database = new Client({ connectionString: testUrl.href, connectionTimeoutMillis: 5000 });
  await database.connect();
  assert.equal(
    (await database.query('SELECT current_database() AS name')).rows[0].name,
    databaseName,
  );
  api = startApi();
  await ready(`${apiOrigin}/health`, api);
  console.log('BUILD isolated optimized CMS web for the test origin');
  buildCreated = true;
  mkdirSync(buildPath, { recursive: true });
  writeFileSync(
    buildConfigPath,
    JSON.stringify({
      extends: '../tsconfig.json',
      include: [
        '../next-env.d.ts',
        '../src/**/*.ts',
        '../src/**/*.tsx',
        `f6-qa-build-${id}/types/**/*.ts`,
      ],
      exclude: ['../node_modules'],
    }),
    { flag: 'wx' },
  );
  const build = child(
    process.execPath,
    [webRequire.resolve('next/dist/bin/next'), 'build'],
    webRoot,
    { ...environment, NODE_ENV: 'production' },
    'isolated CMS web build',
  );
  await new Promise((resolve, reject) => {
    build.process.once('error', () => reject(new Error('Isolated CMS build could not start')));
    build.process.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Isolated CMS build failed')),
    );
  }).catch((error) => {
    console.error(redact(build.diagnostics));
    throw error;
  });
  web = child(
    process.execPath,
    [
      webRequire.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(webPort),
    ],
    webRoot,
    { ...environment, NODE_ENV: 'production' },
    'isolated optimized CMS web',
  );
  await ready(webOrigin, web);
  admin = new Session();
  author = new Session();
  await admin.login('admin@filaretti.test');
  await author.login('author@filaretti.test');
  await domainChecks();
} catch (error) {
  const message = redact(error?.message ?? 'CMS setup failed');
  report.errors.push({ check: 'setup/runtime', message });
  console.error(message);
} finally {
  if (report.errors.length) {
    report.serverDiagnostics = {
      api: redact(api?.diagnostics ?? ''),
      web: redact(web?.diagnostics ?? ''),
    };
  }
  await cleanup().catch((error) => {
    report.errors.push({
      check: 'cleanup',
      message: redact(error?.message ?? 'Owned resource cleanup failed'),
    });
  });
  mkdirSync(dirname(reportPath), { recursive: true });
  report.passed = report.errors.length === 0 && report.checks.length > 0;
  report.finishedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      layouts: report.layouts.length,
      failures: report.errors.length,
      cleanup: report.cleanup,
      report: '.local/f6-qa-smoke.json',
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
