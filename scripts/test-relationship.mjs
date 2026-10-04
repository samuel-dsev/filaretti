import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const apiPort = Number(process.env.F7_TEST_API_PORT ?? 3027);
const webPort = Number(process.env.F7_TEST_WEB_PORT ?? 3026);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const id = randomUUID();
const buildPath = resolve(webRoot, `.local/f7-qa-build-${id}`);
const buildConfigPath = resolve(webRoot, `.local/f7-qa-tsconfig-${id}.json`);
const databaseName = `filaretti_f7_test_${id.replaceAll('-', '')}`;
const evidence = resolve(root, '.local/f7-qa-evidence');
const reportPath = resolve(root, '.local/f7-qa-smoke.json');
const storagePath = resolve(root, `.local/f7-qa-storage-${id}`);
const fixturePath = resolve(root, `.local/f7-qa-fixtures-${id}`);
const marker = `QA F7 ${id.slice(0, 8)}`;
const articleSlug = `qa-f7-${id}`;
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
    'Only fictitious data, local PostgreSQL/storage/API and an optimized web build are exercised; external providers and production are not validated.',
    'Browser analytics checks use development with GA4 disabled; enabled-provider behavior is covered separately with a simulated runtime.',
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
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
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
    assert.match(databaseName, /^filaretti_f7_test_[a-f\d]{32}$/u);
    assert.notEqual(baseUrl.pathname, `/${databaseName}`);
    await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    report.cleanup.databaseRemoved =
      (await operator.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]))
        .rowCount === 0;
  }
  await operator?.end().catch(() => undefined);
  if (buildCreated) {
    assert.equal(buildPath, resolve(webRoot, `.local/f7-qa-build-${id}`));
    assert.ok(buildPath.startsWith(resolve(webRoot, '.local') + sep));
    rmSync(buildPath, { recursive: true, force: true });
    assert.equal(buildConfigPath, resolve(webRoot, `.local/f7-qa-tsconfig-${id}.json`));
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
      assert.equal(path, resolve(root, `.local/f7-qa-${kind}-${id}`));
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

function latestMail(kind, recipient) {
  return database
    .query(
      "SELECT payload,idempotency_key FROM outbox_tasks WHERE topic='mail.send' ORDER BY created_at DESC",
    )
    .then(({ rows }) => {
      const dir = resolve(fixturePath, 'mail');
      const messages = [
        ...rows,
        ...(existsSync(dir)
          ? readdirSync(dir).map((name) => {
              const x = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
              return { payload: x.payload, idempotency_key: x.idempotencyKey };
            })
          : []),
      ];
      for (const row of messages) {
        if (!row.payload?.data) continue;
        const p = row.payload;
        const decipher = createDecipheriv(
          'aes-256-gcm',
          createHash('sha256').update(environment.PREVIEW_SECRET).digest(),
          Buffer.from(p.iv, 'base64'),
        );
        decipher.setAAD(Buffer.from(row.idempotency_key));
        decipher.setAuthTag(Buffer.from(p.tag, 'base64'));
        const message = JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(p.data, 'base64')),
            decipher.final(),
          ]).toString('utf8'),
        );
        if (message.kind === kind && message.recipient === recipient) {
          if (message.token) sensitiveTokens.push(message.token);
          return message;
        }
      }
      throw new Error('Expected local transactional mail not found');
    });
}
async function relationshipChecks() {
  for (const path of [
    '/contato',
    '/newsletter',
    '/perguntas-frequentes',
    '/privacidade',
    '/cookies',
    '/busca?q=direito',
    '/newsletter/confirmar',
    '/newsletter/descadastrar',
    '/admin/recuperar-senha',
    '/admin/redefinir-senha',
  ]) {
    await check(`HTTP ${path}`, async () => {
      const result = await request(`${webOrigin}${path}`);
      assert.match(result.body, /noindex/iu);
      assert.match(result.response.headers.get('x-robots-tag') ?? '', /noindex/iu);
    });
  }
  await check('search PostgreSQL and non-indexable sitemap/robots', async () => {
    const result = await request(`${apiOrigin}/api/v1/public/search?q=direito&limit=2`);
    const search = JSON.parse(result.body);
    assert.ok(search.data.length > 0);
    assert.ok(search.data.length <= 2);
    assert.equal(JSON.stringify(search).includes('passwordHash'), false);
    const sitemap = await request(`${webOrigin}/sitemap.xml`);
    assert.equal(sitemap.body.includes('/admin'), false);
    assert.equal(sitemap.body.includes('<loc>'), false);
    const robots = await request(`${webOrigin}/robots.txt`);
    assert.match(robots.body, /Disallow: \/\s/u);
  });
  if (!browser) return;
  browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await browserContext.newPage();
  const errors = [];
  const analytics = [];
  page.on('pageerror', (error) => errors.push(redact(error.message)));
  browserContext.on('request', (r) => {
    if (/google-analytics|googletagmanager/iu.test(r.url())) analytics.push(r.url());
  });
  await page.goto(`${webOrigin}/contato`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Somente necessários', exact: true }).first().click();
  await check(
    'contact UI persists private attachment and separates newsletter consent',
    async () => {
      await page.getByLabel(fieldName('Nome'), { exact: true }).fill('Pessoa Fictícia F7');
      await page.keyboard.press('Tab');
      assert.equal(
        await page
          .getByLabel(fieldName('E-mail'), { exact: true })
          .evaluate((element) => document.activeElement === element),
        true,
      );
      await page
        .getByLabel(fieldName('E-mail'), { exact: true })
        .fill('qa-f7-contact@example.invalid');
      await page.getByLabel(fieldName('Assunto'), { exact: true }).fill('Solicitação fictícia F7');
      await page
        .getByLabel(fieldName('Mensagem'), { exact: true })
        .fill('Mensagem fictícia de validação do contato completo.');
      await page
        .locator('input[name=attachments]')
        .setInputFiles(resolve(fixturePath, 'cover.png'));
      await page.locator('input[name=privacyAccepted]').check();
      await page.getByRole('button', { name: 'Enviar solicitação', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('status').filter({ hasText: 'Solicitação recebida' }).waitFor();
      const row = (
        await database.query("SELECT id FROM contacts WHERE email='qa-f7-contact@example.invalid'")
      ).rows[0];
      assert.ok(row);
      const files = await database.query(
        'SELECT storage_key,scan_status FROM contact_files WHERE contact_id=$1',
        [row.id],
      );
      assert.equal(files.rows.length, 1);
      assert.equal(files.rows[0].scan_status, 'LOCAL_VERIFIED');
      await request(`${webOrigin}/media/public/${files.rows[0].storage_key}`, 404);
      assert.equal(
        (
          await database.query(
            "SELECT COUNT(*)::int n FROM newsletter_subscribers WHERE email='qa-f7-contact@example.invalid'",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  const email = 'qa-f7-newsletter@example.invalid';
  await check(
    'newsletter browser double opt-in and unsubscribe consume fragment tokens',
    async () => {
      await page.goto(`${webOrigin}/newsletter`, { waitUntil: 'networkidle' });
      await page.getByLabel(fieldName('E-mail'), { exact: true }).fill(email);
      await page.locator('input[name=consent]').check();
      await page.getByRole('button', { name: 'Solicitar inscrição', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'instruções por e-mail' }).waitFor();
      assert.equal(
        (await database.query('SELECT status FROM newsletter_subscribers WHERE email=$1', [email]))
          .rows[0].status,
        'PENDING',
      );
      const confirmation = await latestMail('newsletter-confirm', email);
      await page.goto(`${webOrigin}/newsletter/confirmar#token=${confirmation.token}`, {
        waitUntil: 'networkidle',
      });
      assert.equal(new URL(page.url()).hash, '');
      await page.setViewportSize({ width: 375, height: 1000 });
      await auditPage(page, 'confirm-valid', 375);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await auditPage(page, 'confirm-valid', 1440);
      await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Inscrição confirmada' }).waitFor();
      assert.equal(
        (await database.query('SELECT status FROM newsletter_subscribers WHERE email=$1', [email]))
          .rows[0].status,
        'ACTIVE',
      );
      const unsubscribe = await latestMail('newsletter-unsubscribe', email);
      await page.goto(`${webOrigin}/newsletter/descadastrar#token=${unsubscribe.token}`, {
        waitUntil: 'networkidle',
      });
      await page.setViewportSize({ width: 375, height: 1000 });
      await auditPage(page, 'unsubscribe-valid', 375);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await auditPage(page, 'unsubscribe-valid', 1440);
      await page.getByRole('button', { name: 'Confirmar descadastro', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Descadastro concluído' }).waitFor();
      assert.equal(
        (await database.query('SELECT status FROM newsletter_subscribers WHERE email=$1', [email]))
          .rows[0].status,
        'UNSUBSCRIBED',
      );
    },
  );
  await check('search overlay navigates to real filtered results', async () => {
    await page.goto(webOrigin, { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: /[Bb]uscar|[Bb]usca/u })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('searchbox').fill('direito');
    await dialog.getByRole('button', { name: 'Ver resultados', exact: true }).click();
    await page.waitForURL(/\/busca\?q=direito/u);
    assert.ok((await page.locator('main').innerText()).includes('direito'));
  });
  await check('local cookie preferences keep analytics disabled', async () => {
    await page.goto(`${webOrigin}/cookies`, { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: 'Preferências de cookies', exact: true })
      .first()
      .click();
    await page
      .getByRole('dialog')
      .getByRole('checkbox', { name: /Analytics/u })
      .check();
    await page.setViewportSize({ width: 375, height: 1000 });
    await auditPage(page, 'cookie-preferences', 375);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await auditPage(page, 'cookie-preferences', 1440);
    await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
    await page
      .getByRole('button', { name: 'Preferências de cookies', exact: true })
      .first()
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Somente necessários', exact: true })
      .click();
    assert.equal(await page.locator('script[data-filaretti-analytics]').count(), 0);
    assert.deepEqual(analytics, []);
  });
  await check('password recovery works through local encrypted outbox and admin UI', async () => {
    await page.goto(`${webOrigin}/admin/recuperar-senha`, { waitUntil: 'networkidle' });
    await page.getByLabel(fieldName('E-mail'), { exact: true }).fill('author@filaretti.test');
    await page.getByRole('button', { name: 'Solicitar link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'você receberá instruções' }).waitFor();
    const recovery = await latestMail('recovery', 'author@filaretti.test');
    await page.goto(`${webOrigin}/admin/redefinir-senha#token=${recovery.token}`, {
      waitUntil: 'networkidle',
    });
    await page.setViewportSize({ width: 375, height: 1000 });
    await auditPage(page, 'reset-valid', 375);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await auditPage(page, 'reset-valid', 1440);
    await page.getByLabel(fieldName('Nova senha'), { exact: true }).fill('Local-F7-Ficticio!2026');
    const confirm = page.getByLabel(fieldName('Confirmar nova senha'), { exact: true });
    if (await confirm.count()) await confirm.fill('Local-F7-Ficticio!2026');
    await page.getByRole('button', { name: /[Rr]edefinir|[Ss]alvar/u }).click();
    await page.getByRole('status').filter({ hasText: 'Senha redefinida' }).waitFor();
    await page.goto(`${webOrigin}/admin/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(fieldName('E-mail'), { exact: true }).fill('author@filaretti.test');
    await page.getByLabel(fieldName('Senha'), { exact: true }).fill('Local-F7-Ficticio!2026');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(`${webOrigin}/admin`);
    assert.equal(await page.getByRole('link', { name: 'Contatos', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForURL(`${webOrigin}/admin/login`);
  });
  await check('ADMIN manages contacts, private downloads and subscribers', async () => {
    await page.getByLabel(fieldName('E-mail'), { exact: true }).fill('admin@filaretti.test');
    await page.getByLabel(fieldName('Senha'), { exact: true }).fill(developmentPassword);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(`${webOrigin}/admin`);
    await page.goto(`${webOrigin}/admin/contatos`, { waitUntil: 'networkidle' });
    const row = page.getByRole('row').filter({ hasText: 'Solicitação fictícia F7' }).first();
    await row.waitFor();
    await row.getByRole('button', { name: 'Ver solicitação', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.ok((await dialog.innerText()).includes('Mensagem fictícia de validação'));
    await auditPage(page, 'contact-detail', 1440);
    await page.setViewportSize({ width: 375, height: 1000 });
    await auditPage(page, 'contact-detail', 375);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const attachmentPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Baixar anexo privado', exact: true }).click();
    const attachment = await attachmentPromise;
    assert.equal(await attachment.failure(), null);
    assert.equal(attachment.suggestedFilename(), 'cover.png');
    await dialog
      .getByLabel(fieldName('Status da solicitação'), { exact: true })
      .selectOption('IN_PROGRESS');
    await dialog.getByRole('button', { name: 'Salvar status', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Status atualizado' }).waitFor();
    assert.equal(
      (
        await database.query(
          "SELECT status FROM contacts WHERE email='qa-f7-contact@example.invalid'",
        )
      ).rows[0].status,
      'IN_PROGRESS',
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.goto(`${webOrigin}/admin/assinantes`, { waitUntil: 'networkidle' });
    await page.getByText(email, { exact: true }).first().waitFor();
    const csvPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
    const csv = await csvPromise;
    assert.equal(await csv.failure(), null);
    assert.equal(csv.suggestedFilename(), 'assinantes.csv');
    const csvContents = readFileSync(await csv.path(), 'utf8');
    assert.ok(csvContents.includes(email));
  });
  await check('F7 templates fit five viewports and have labelled controls', async () => {
    for (const [name, path] of [
      ['contact', '/contato'],
      ['newsletter', '/newsletter'],
      ['confirm', '/newsletter/confirmar'],
      ['unsubscribe', '/newsletter/descadastrar'],
      ['search', '/busca?q=direito'],
      ['faq', '/perguntas-frequentes'],
      ['privacy', '/privacidade'],
      ['cookies', '/cookies'],
      ['recovery', '/admin/recuperar-senha'],
      ['reset', '/admin/redefinir-senha'],
      ['contacts', '/admin/contatos'],
      ['subscribers', '/admin/assinantes'],
    ]) {
      await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1 }).waitFor();
      for (const width of [375, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await auditPage(page, name, width);
      }
    }
  });
  await check('browser has no unhandled JavaScript failures', async () =>
    assert.deepEqual(errors, []),
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
      channel: process.env.F7_TEST_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    report.browser = {
      channel: process.env.F7_TEST_BROWSER_CHANNEL ?? 'msedge',
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
    NEXT_PUBLIC_SITE_URL: webOrigin,
    FILARETTI_QA_BUILD_ID: id,
    FILARETTI_QA_PHASE: 'f7',
    MOCK_INTEGRATIONS: 'true',
    NEXT_PUBLIC_MOCK_INTEGRATIONS: 'true',
    RELATIONSHIP_ENABLED: 'true',
    MAIL_LOCAL_PATH: resolve(fixturePath, 'mail'),
    GA4_ENABLED: 'false',
    SEO_INDEXING_ENABLED: 'false',
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
  console.log('BUILD isolated optimized F7 web for the test origin');
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
        `f7-qa-build-${id}/types/**/*.ts`,
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
    'isolated F7 web build',
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
    'isolated optimized F7 web',
  );
  await ready(webOrigin, web);
  admin = new Session();
  author = new Session();
  await admin.login('admin@filaretti.test');
  await author.login('author@filaretti.test');
  await relationshipChecks();
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
      report: '.local/f7-qa-smoke.json',
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
