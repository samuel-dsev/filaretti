import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Requires built API and an existing Playwright/browser. Builds an isolated web artifact.
// Only resources created by this run are changed: a new DB, local storage and child processes.
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
const skipLighthouse = process.argv.includes('--skip-lighthouse');
const lighthouseOnly = process.argv.includes('--lighthouse-only');
const rootRequire = createRequire(resolve(root, 'package.json'));
let playwright;
const apiPort = Number(process.env.F8_TEST_API_PORT ?? 3037);
const webPort = Number(process.env.F8_TEST_WEB_PORT ?? 3036);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const id = randomUUID();
const buildPath = resolve(webRoot, `.local/f8-qa-build-${id}`);
const buildConfigPath = resolve(webRoot, `.local/f8-qa-tsconfig-${id}.json`);
const databaseName = `filaretti_f8_test_${id.replaceAll('-', '')}`;
const evidence = resolve(root, '.local/f8-qa-evidence');
const reportFile = lighthouseOnly
  ? '.local/f8-lighthouse-smoke.json'
  : skipLighthouse
    ? '.local/f8-layout-smoke.json'
    : '.local/f8-qa-smoke.json';
const reportPath = resolve(root, reportFile);
const storagePath = resolve(root, `.local/f8-qa-storage-${id}`);
const fixturePath = resolve(root, `.local/f8-qa-fixtures-${id}`);
const developmentPassword = 'Local-F2-Ficticio!2026';
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
  browserMatrix: [],
  lighthouse: [],
  performanceTargets: { performance: 90, accessibility: 90, 'best-practices': 90, seo: 95 },
  limitations: [
    'Only fictitious data, local PostgreSQL/storage/API and an optimized web build are exercised; external providers and production are not validated.',
    'Browser analytics checks use development with GA4 disabled; enabled-provider behavior is covered separately with a simulated runtime.',
    'An existing browser/runtime is required; this script installs neither dependencies nor browsers.',
    'Axe, viewport, keyboard and solid-text checks do not certify full WCAG, screen readers, physical devices or other engines.',
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
  const deferred = await page.locator('.institution-section').count();
  if (deferred) {
    // Chromium captureBeyondViewport doesn't paint sections skipped by content-visibility.
    // Preserve the actual viewport first, then expand only the capture viewport so all
    // sections are relevant to rendering. Restore it before keyboard/axe checks.
    const viewport = page.viewportSize();
    await page.screenshot({ path: resolve(evidence, `${name}-${width}-viewport.png`) });
    try {
      for (let iteration = 0; iteration < 3; iteration++) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        assert.ok(height > 0 && height <= 30000, 'Bounded full-document capture height');
        await page.setViewportSize({ width, height: Math.max(viewport.height, height) });
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        );
      }
      await page.screenshot({ path: resolve(evidence, `${name}-${width}.png`), fullPage: true });
      audit.capture = 'full document viewport expanded for painting; initial viewport retained';
    } finally {
      await page.setViewportSize(viewport);
    }
  } else {
    await page.screenshot({ path: resolve(evidence, `${name}-${width}.png`), fullPage: true });
    audit.capture = 'native full page';
  }
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
    'isolated F8 API',
  );
}

async function cleanup() {
  await browser?.close().catch(() => undefined);
  await stop(web);
  await stop(api);
  report.cleanup.processesStopped = [web, api].every(
    (running) =>
      !running || running.process.exitCode !== null || running.process.signalCode !== null,
  );
  await database?.end().catch(() => undefined);
  if (databaseCreated) {
    assert.match(databaseName, /^filaretti_f8_test_[a-f\d]{32}$/u);
    assert.notEqual(baseUrl.pathname, `/${databaseName}`);
    await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    report.cleanup.databaseRemoved =
      (await operator.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]))
        .rowCount === 0;
  }
  await operator?.end().catch(() => undefined);
  if (buildCreated) {
    assert.equal(buildPath, resolve(webRoot, `.local/f8-qa-build-${id}`));
    assert.ok(buildPath.startsWith(resolve(webRoot, '.local') + sep));
    rmSync(buildPath, { recursive: true, force: true });
    assert.equal(buildConfigPath, resolve(webRoot, `.local/f8-qa-tsconfig-${id}.json`));
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
      assert.equal(path, resolve(root, `.local/f8-qa-${kind}-${id}`));
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

const publicTemplates = [
  ['home', '/'],
  ['office', '/o-escritorio'],
  ['areas', '/areas-de-atuacao'],
  ['area-detail', '/areas-de-atuacao/area-ficticia-1'],
  ['professionals', '/profissionais'],
  ['professional-detail', '/profissionais/profissional-ficticio-1'],
  ['contents', '/conteudos'],
  ['article', '/conteudos/conteudo-ficticio-01'],
  ['update', '/conteudos/conteudo-ficticio-02'],
  ['guide', '/conteudos/conteudo-ficticio-03'],
  ['contact', '/contato'],
  ['newsletter', '/newsletter'],
  ['confirm', '/newsletter/confirmar'],
  ['unsubscribe', '/newsletter/descadastrar'],
  ['search', '/busca?q=direito'],
  ['faq', '/perguntas-frequentes'],
  ['privacy', '/privacidade'],
  ['cookies', '/cookies'],
];
const adminTemplates = [
  ['dashboard', '/admin'],
  ['admin-articles', '/admin/artigos'],
  ['admin-categories', '/admin/categorias'],
  ['admin-tags', '/admin/tags'],
  ['admin-areas', '/admin/areas'],
  ['admin-professionals', '/admin/profissionais'],
  ['admin-pages', '/admin/paginas'],
  ['admin-faq', '/admin/faq'],
  ['admin-media', '/admin/midia'],
  ['admin-contacts', '/admin/contatos'],
  ['admin-subscribers', '/admin/assinantes'],
  ['admin-users', '/admin/usuarios'],
  ['admin-redirects', '/admin/redirects'],
  ['admin-settings', '/admin/configuracoes'],
  ['admin-article-editor', '/admin/artigos/novo'],
  ['admin-category-editor', '/admin/categorias/novo'],
  ['admin-tag-editor', '/admin/tags/novo'],
  ['admin-area-editor', '/admin/areas/novo'],
  ['admin-professional-editor', '/admin/profissionais/novo'],
  ['admin-page-editor', '/admin/paginas/novo'],
  ['admin-faq-editor', '/admin/faq/novo'],
  ['admin-redirect-editor', '/admin/redirects/novo'],
];
const auxiliaryTemplates = [];

async function axeAudit(page, name, width, channel) {
  const { default: AxeBuilder } = rootRequire('@axe-core/playwright');
  const result = await new AxeBuilder({ page })
    .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const violations = result.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    description: item.description,
    nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
  }));
  report.accessibility ??= [];
  report.accessibility.push({
    name,
    width,
    channel,
    passes: result.passes.length,
    incomplete: result.incomplete.map((item) => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    })),
    violations,
  });
  assert.deepEqual(violations, [], `${name} ${channel} ${width}: axe WCAG violations`);
}

async function layoutChecks(channel, fullMatrix) {
  const currentBrowser =
    channel === report.browser.channel
      ? browser
      : await playwright.chromium.launch({ channel, headless: true });
  report.browserMatrix.push({
    channel,
    engine: 'Chromium',
    version: currentBrowser.version(),
    executed: true,
    physicalDevice: false,
  });
  const context = await currentBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const analytics = [];
  page.on('pageerror', (error) => errors.push(redact(error.message)));
  context.on('request', (req) => {
    if (/google-analytics|googletagmanager/iu.test(req.url()))
      analytics.push(new URL(req.url()).hostname);
  });
  try {
    await check(`${channel} enforced CSP blocks untrusted inline script`, async () => {
      // Parser-inserted markup models XSS. CDP evaluate/append is trusted debugger
      // instrumentation and can inherit strict-dynamic; it is not an XSS probe.
      const handler = async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace(
          '<head>',
          '<head><script>window.__filarettiF8InlineExecuted = true</script>',
        );
        await route.fulfill({ response, body: html });
      };
      await page.route(`${webOrigin}/`, handler);
      try {
        await page.goto(webOrigin, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => window.__filarettiF8InlineExecuted === true), false);
        assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      } finally {
        await page.unroute(`${webOrigin}/`, handler);
      }
    });
    await check(`${channel} primary publication is readable without JavaScript`, async () => {
      const noScript = await currentBrowser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 375, height: 1000 },
      });
      try {
        const document = await noScript.newPage();
        await document.goto(
          `${webOrigin}${publicTemplates.find(([name]) => name === 'article')[1]}`,
          { waitUntil: 'networkidle' },
        );
        assert.equal(await document.locator('#publicacao-titulo').isVisible(), true);
        assert.equal(await document.locator('.editorial-reading-body').isVisible(), true);
        assert.equal(await document.getByRole('heading', { level: 1 }).count(), 1);
      } finally {
        await noScript.close();
      }
    });
    const templates = [
      ...publicTemplates,
      ['login', '/admin/login'],
      ['recovery', '/admin/recuperar-senha'],
      ['reset', '/admin/redefinir-senha'],
      ...auxiliaryTemplates,
    ];
    for (const [name, path] of templates)
      await check(`${channel} template ${name}`, async () => {
        await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { level: 1 }).waitFor();
        for (const width of fullMatrix ? [375, 768, 1024, 1440, 1920] : [1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await auditPage(page, `${channel}-${name}`, width);
          if (width === 375 || width === 1440) await axeAudit(page, name, width, channel);
        }
      });
    await check(
      `${channel} navigation fetches the public destination only after interaction`,
      async () => {
        const requests = [];
        const capture = (request) => {
          if (new URL(request.url()).searchParams.has('_rsc')) requests.push(request.url());
        };
        page.on('request', capture);
        try {
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.goto(
            `${webOrigin}${publicTemplates.find(([name]) => name === 'article')[1]}`,
            { waitUntil: 'networkidle' },
          );
          assert.equal(
            requests.length,
            0,
            'Initial article must not fetch unrelated public routes',
          );
          await page.getByRole('link', { name: 'O escritório', exact: true }).first().click();
          await page.waitForURL(`${webOrigin}/o-escritorio`);
          await page.getByRole('heading', { level: 1 }).waitFor();
          assert.ok(requests.some((url) => new URL(url).pathname === '/o-escritorio'));
        } finally {
          page.off('request', capture);
        }
      },
    );
    await check(
      `${channel} offscreen sections remain reachable by focus and keyboard`,
      async () => {
        await page.setViewportSize({ width: 375, height: 1000 });
        await page.goto(`${webOrigin}${publicTemplates.find(([name]) => name === 'article')[1]}`, {
          waitUntil: 'networkidle',
        });
        const necessary = page.getByRole('button', { name: 'Somente necessários', exact: true });
        if (await necessary.isVisible()) await necessary.click();
        const destination = page
          .locator('#relacionados')
          .getByRole('link', { name: 'Todos os conteúdos', exact: true });
        await destination.focus();
        await page.waitForFunction(() => document.activeElement?.closest('#relacionados') !== null);
        const focused = await destination.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            active: node === document.activeElement,
            top: rect.top,
            bottom: rect.bottom,
            viewport: innerHeight,
          };
        });
        assert.ok(focused.active);
        assert.ok(focused.top >= 0 && focused.bottom <= focused.viewport);
        await page.screenshot({
          path: resolve(evidence, `${channel}-offscreen-section-focus-375.png`),
        });
        await page.keyboard.press('Enter');
        await page.waitForURL(`${webOrigin}/conteudos`);
        await page.getByRole('heading', { level: 1 }).waitFor();
      },
    );
    await check(`${channel} keyboard navigation, FAQ and cookie preferences`, async () => {
      await page.goto(webOrigin, { waitUntil: 'networkidle' });
      await page.keyboard.press('Tab');
      assert.match(await page.locator(':focus').innerText(), /[Pp]ular|[Ii]r para/u);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'conteudo');
      await page.goto(`${webOrigin}/perguntas-frequentes`, { waitUntil: 'networkidle' });
      const question = page
        .locator('summary')
        .filter({ hasText: /Pergunta Fictícia/u })
        .first();
      await question.focus();
      await page.keyboard.press('Enter');
      assert.equal(
        await question.evaluate((node) => node.parentElement.hasAttribute('open')),
        true,
      );
      await page.keyboard.press('Enter');
      assert.equal(
        await question.evaluate((node) => node.parentElement.hasAttribute('open')),
        false,
      );
      await page.goto(`${webOrigin}/cookies`, { waitUntil: 'networkidle' });
      const preferences = page
        .getByRole('button', { name: 'Preferências de cookies', exact: true })
        .first();
      await preferences.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.ok(
        await page
          .locator(':focus')
          .evaluate((node) => Boolean(node.closest('dialog,[role="dialog"]'))),
      );
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await preferences.evaluate((node) => node === document.activeElement), true);
      assert.deepEqual(analytics, []);
    });
    await check(`${channel} login and dashboard use actual API session`, async () => {
      await page.goto(`${webOrigin}/admin/login`, { waitUntil: 'networkidle' });
      await page.getByLabel(fieldName('E-mail'), { exact: true }).fill('admin@filaretti.test');
      await page.getByLabel(fieldName('Senha'), { exact: true }).fill(developmentPassword);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL(`${webOrigin}/admin`);
      assert.equal(await page.evaluate(() => localStorage.getItem('filaretti_access')), null);
      const sessionCookies = await context.cookies();
      assert.ok(
        sessionCookies.some((cookie) => cookie.name === 'filaretti_access' && cookie.httpOnly),
      );
    });
    if (fullMatrix)
      for (const [name, path] of adminTemplates)
        await check(`${channel} template ${name}`, async () => {
          await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
          await page.getByRole('heading', { level: 1 }).waitFor();
          for (const width of [375, 768, 1024, 1440, 1920]) {
            await page.setViewportSize({ width, height: 1000 });
            await auditPage(page, `${channel}-${name}`, width);
            if (width === 375 || width === 1440) await axeAudit(page, name, width, channel);
          }
        });
    await check(`${channel} ADMIN contact dialog keyboard and role semantics`, async () => {
      await page.goto(`${webOrigin}/admin/contatos`, { waitUntil: 'networkidle' });
      const open = page.getByRole('button', { name: 'Ver solicitação', exact: true }).first();
      await open.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.ok(
        await page
          .locator(':focus')
          .evaluate((node) => Boolean(node.closest('dialog,[role="dialog"]'))),
      );
      await axeAudit(page, 'admin-contact-dialog', 1440, channel);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await open.evaluate((node) => node === document.activeElement), true);
    });
    await check(`${channel} no unhandled browser errors or analytics requests`, async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(analytics, []);
    });
  } finally {
    await context.close();
    if (currentBrowser !== browser) await currentBrowser.close();
  }
}

async function lighthouseChecks() {
  const packagePath = rootRequire.resolve('lighthouse/package.json');
  const { default: lighthouse } = await import(
    pathToFileURL(rootRequire.resolve('lighthouse')).href
  );
  const lighthouseRequire = createRequire(packagePath);
  const { launch } = lighthouseRequire('chrome-launcher');
  const browserPath =
    process.env.F8_LIGHTHOUSE_BROWSER_PATH ??
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : playwright.chromium.executablePath());
  assert.ok(
    existsSync(browserPath),
    'Provide an existing F8_LIGHTHOUSE_BROWSER_PATH; browsers are never downloaded.',
  );
  const launcher = await launch({
    chromePath: browserPath,
    chromeFlags: [
      '--headless=new',
      '--no-first-run',
      '--disable-background-networking',
      ...(process.env.CI ? ['--no-sandbox'] : []),
    ],
    logLevel: 'silent',
  });
  if (launcher.pid) report.ownedProcesses.push({ label: 'Lighthouse browser', pid: launcher.pid });
  report.lighthouseConditions = {
    version: JSON.parse(readFileSync(packagePath, 'utf8')).version,
    formFactor: 'mobile',
    throttlingMethod: 'simulate',
    port: launcher.port,
    browser: browserPath,
    optimizedBuild: true,
    noindex: true,
    iterationsPerTemplate: 3,
    aggregation: 'median performance run; accessibility and best practices must pass every run',
  };
  try {
    for (const [name, path] of publicTemplates) {
      const samples = [];
      for (
        let iteration = 1;
        iteration <= report.lighthouseConditions.iterationsPerTemplate;
        iteration++
      ) {
        console.log(`MEASURE Lighthouse ${name} ${iteration}/3`);
        const { lhr } = await lighthouse(`${webOrigin}${path}`, {
          port: launcher.port,
          logLevel: 'error',
          output: 'json',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          formFactor: 'mobile',
          throttlingMethod: 'simulate',
        });
        if (report.lighthouse.length === 0) {
          report.lighthouseConditions.throttling = lhr.configSettings.throttling;
          report.lighthouseConditions.screenEmulation = lhr.configSettings.screenEmulation;
          report.lighthouseConditions.browserStorageReset = !lhr.configSettings.disableStorageReset;
          report.lighthouseConditions.serverPreflight =
            'Public HTTP routes validated before measurements';
          report.lighthouseConditions.userAgent = lhr.userAgent;
        }
        const scores = Object.fromEntries(
          Object.entries(lhr.categories).map(([key, category]) => [
            key,
            Math.round((category.score ?? 0) * 100),
          ]),
        );
        const failedAudits = Object.entries(lhr.audits)
          .filter(([, audit]) => audit.score !== null && audit.score < 1)
          .map(([key, audit]) => ({
            id: key,
            score: audit.score,
            title: audit.title,
            displayValue: audit.displayValue,
          }));
        const metrics = Object.fromEntries(
          [
            'first-contentful-paint',
            'largest-contentful-paint',
            'total-blocking-time',
            'cumulative-layout-shift',
            'speed-index',
          ].map((key) => [key, lhr.audits[key].numericValue]),
        );
        const targetsMet = Object.entries(report.performanceTargets).every(
          ([key, target]) => scores[key] >= target,
        );
        const sample = { iteration, scores, metrics, targetsMet, failedAudits };
        samples.push(sample);
        writeFileSync(
          resolve(evidence, `lighthouse-${name}-run-${iteration}.json`),
          JSON.stringify(lhr, null, 2),
        );
        console.log(JSON.stringify({ name, iteration, scores, targetsMet }));
      }
      // Choose by a fixed median rule, never repeat until a favorable score appears.
      const selected = [...samples].sort((a, b) => a.scores.performance - b.scores.performance)[1];
      const result = { name, path, ...selected, selectedIteration: selected.iteration, samples };
      report.lighthouse.push(result);
      writeFileSync(
        resolve(evidence, `lighthouse-${name}.json`),
        readFileSync(resolve(evidence, `lighthouse-${name}-run-${selected.iteration}.json`)),
      );
      await check(`Lighthouse quality ${name}`, async () => {
        assert.ok(
          result.scores.performance >= report.performanceTargets.performance,
          `${name} median performance: ${result.scores.performance} < ${report.performanceTargets.performance}`,
        );
        for (const sample of samples)
          for (const category of ['accessibility', 'best-practices'])
            assert.ok(
              sample.scores[category] >= report.performanceTargets[category],
              `${name} run ${sample.iteration} ${category}: ${sample.scores[category]} < ${report.performanceTargets[category]}`,
            );
      });
    }
  } finally {
    await launcher.kill();
    report.cleanup.lighthouseBrowserStopped = true;
  }
}

async function qaChecks() {
  // Fictitious seeded slugs are resolved from real PostgreSQL rather than duplicated assumptions.
  const area = (
    await database.query(
      'SELECT slug FROM practice_areas WHERE is_active=true ORDER BY slug LIMIT 1',
    )
  ).rows[0];
  const professional = (
    await database.query(
      'SELECT slug FROM professionals WHERE is_active=true ORDER BY slug LIMIT 1',
    )
  ).rows[0];
  publicTemplates.find(([name]) => name === 'area-detail')[1] = `/areas-de-atuacao/${area.slug}`;
  publicTemplates.find(([name]) => name === 'professional-detail')[1] =
    `/profissionais/${professional.slug}`;
  await check('all public routes retain protected local noindex and security headers', async () => {
    for (const [name, path] of publicTemplates) {
      const { response, body } = await request(`${webOrigin}${path}`);
      assert.match(body, /noindex/iu, `${name} noindex`);
      assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/iu);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.ok(response.headers.get('permissions-policy'));
      assert.ok(response.headers.get('content-security-policy'), `${name} CSP`);
    }
  });
  await check('withdrawn privacy and cookie pages return HTTP 404 before streaming', async () => {
    for (const slug of ['privacidade', 'cookies']) {
      const original = (await database.query('SELECT id,status FROM pages WHERE slug=$1', [slug]))
        .rows[0];
      assert.ok(original, 'Owned policy fixture exists');
      try {
        await database.query("UPDATE pages SET status='ARCHIVED' WHERE id=$1", [original.id]);
        await request(`${webOrigin}/${slug}`, 404);
      } finally {
        await database.query('UPDATE pages SET status=$1::"PublicationStatus" WHERE id=$2', [
          original.status,
          original.id,
        ]);
      }
      assert.equal((await request(`${webOrigin}/${slug}`)).response.status, 200);
    }
  });
  await check('home and office expose the implemented newsletter route', async () => {
    for (const path of ['/', '/o-escritorio']) {
      const { body } = await request(`${webOrigin}${path}`);
      assert.match(body, /href="\/newsletter"/u);
      assert.doesNotMatch(body, /disponível em próxima etapa/iu);
    }
  });
  await check('public documents exclude administration and demo styles', async () => {
    const styles = {};
    for (const [name, path] of [
      ['public', '/'],
      ['admin', '/admin/login'],
      ['demo', '/dev/design-system'],
    ]) {
      const { response, body } = await request(`${webOrigin}${path}`);
      assert.equal(response.status, 200);
      const links = [...body.matchAll(/<link\b[^>]*>/gu)]
        .map(([tag]) => ({
          rel: tag.match(/\brel="([^"]+)"/u)?.[1],
          href: tag.match(/\bhref="([^"]+)"/u)?.[1],
        }))
        .filter((link) => link.rel === 'stylesheet' && link.href);
      assert.ok(links.length, `${name} has stylesheet links`);
      let css = '';
      for (const link of links) {
        const result = await request(new URL(link.href, webOrigin).href);
        assert.equal(result.response.status, 200);
        css += result.body;
      }
      styles[name] = css;
    }
    assert.ok(!styles.public.includes('.admin-sidebar'));
    assert.ok(!styles.public.includes('.demo-grid'));
    assert.ok(styles.admin.includes('.admin-sidebar'));
    assert.ok(!styles.admin.includes('.demo-grid'));
    assert.ok(styles.demo.includes('.admin-sidebar'));
    assert.ok(styles.demo.includes('.demo-grid'));
    report.stylesheetBytes = Object.fromEntries(
      Object.entries(styles).map(([name, css]) => [name, Buffer.byteLength(css)]),
    );
  });
  if (browser && !lighthouseOnly) {
    const draft = (
      await database.query(
        "SELECT id,version FROM articles WHERE status='DRAFT' ORDER BY slug LIMIT 1",
      )
    ).rows[0];
    const preview = await admin.call(
      `/admin/articles/${draft.id}/preview`,
      'POST',
      { version: draft.version },
      201,
    );
    sensitiveTokens.push(preview.token);
    auxiliaryTemplates.push(
      ['not-found', `/qa-f8-not-found-${id}`],
      ['private-preview', `/preview/${preview.token}`],
    );
    await layoutChecks(report.browser.channel, true);
    if (report.browser.channel !== 'chrome') {
      try {
        await layoutChecks('chrome', false);
      } catch (error) {
        report.browserMatrix.push({
          channel: 'chrome',
          executed: false,
          reason: redact(error.message),
        });
      }
    }
    for (const engine of ['firefox', 'webkit']) {
      try {
        const probe = await playwright[engine].launch({ headless: true });
        const context = await probe.newContext();
        const page = await context.newPage();
        await page.goto(webOrigin, { waitUntil: 'networkidle' });
        assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
        report.browserMatrix.push({
          channel: engine,
          version: probe.version(),
          executed: true,
          coverage: 'home smoke only',
          physicalDevice: false,
        });
        await probe.close();
      } catch {
        report.browserMatrix.push({
          channel: engine,
          executed: false,
          reason: 'Existing compatible browser binary unavailable; no installation attempted.',
        });
      }
    }
    report.browserMatrix.push(
      ...['Safari macOS', 'Chrome Android physical', 'Safari iOS physical', 'screen reader'].map(
        (channel) => ({
          channel,
          executed: false,
          reason: 'Compatible physical system/device or assistive-technology session unavailable.',
        }),
      ),
    );
  }
  if (!skipLighthouse && !httpOnly) await lighthouseChecks();
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
  assert.ok(existsSync(resolve(apiRoot, 'dist/main.js')), 'Build API before running');
  assert.notEqual(apiPort, webPort);
  await freePort(apiPort);
  await freePort(webPort);
  if (!httpOnly) {
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
      channel: process.env.F8_TEST_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    report.browser = {
      channel: process.env.F8_TEST_BROWSER_CHANNEL ?? 'msedge',
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
    FILARETTI_QA_PHASE: 'f8',
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
    CONTACT_SCANNER_DRIVER: 'disabled',
    BFF_CLIENT_IP_SECRET: '',
    WEB_CLIENT_IP_HEADER: '',
    WEB_TRUSTED_PROXY_CONFIRMED: 'false',
  };
  mkdirSync(evidence, { recursive: true });
  mkdirSync(storagePath, { recursive: false });
  mkdirSync(fixturePath, { recursive: false });
  directoriesCreated = true;
  operator = new Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
  await operator.connect();
  await operator.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  await command(['exec', 'prisma', 'migrate', 'deploy'], environment, 'isolated F8 migrations');
  await command(
    ['exec', 'tsx', 'prisma/seed-development.ts'],
    environment,
    'isolated fictitious F8 seed',
  );
  database = new Client({ connectionString: testUrl.href, connectionTimeoutMillis: 5000 });
  await database.connect();
  assert.equal(
    (await database.query('SELECT current_database() AS name')).rows[0].name,
    databaseName,
  );
  api = startApi();
  await ready(`${apiOrigin}/health`, api);
  console.log('BUILD isolated optimized F8 web for the test origin');
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
        `f8-qa-build-${id}/types/**/*.ts`,
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
    'isolated F8 web build',
  );
  await new Promise((resolve, reject) => {
    build.process.once('error', () => reject(new Error('Isolated F8 build could not start')));
    build.process.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Isolated F8 build failed')),
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
    'isolated optimized F8 web',
  );
  await ready(webOrigin, web);
  admin = new Session();
  await admin.login('admin@filaretti.test');
  await qaChecks();
} catch (error) {
  const message = redact(error?.message ?? 'F8 QA setup failed');
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
  report.lighthouseTargetsMet =
    report.lighthouse.length > 0 && report.lighthouse.every((result) => result.targetsMet);
  report.finishedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      layouts: report.layouts.length,
      failures: report.errors.length,
      browsers: report.browserMatrix,
      lighthouseTemplates: report.lighthouse.length,
      lighthouseTargetsMet: report.lighthouseTargetsMet,
      cleanup: report.cleanup,
      report: reportFile,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
