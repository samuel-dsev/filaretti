import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

// Run through pnpm after building API and web. The test creates its own local
// database/processes/raster; it never migrates, reseeds or resets an existing DB.
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
const apiPort = Number(process.env.F4_TEST_API_PORT ?? 3005);
const webPort = Number(process.env.F4_TEST_WEB_PORT ?? 3004);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const evidence = resolve(root, '.local/f4-evidence');
const reportPath = resolve(root, '.local/f4-smoke.json');
const id = randomUUID();
const databaseName = `filaretti_f4_test_${id.replaceAll('-', '')}`;
const fixtureUrl = `/media/public/f4-fixture-${id}.png`;
const fixtureFile = resolve(webRoot, `public${fixtureUrl}`);
const routes = [
  '/',
  '/o-escritorio',
  '/areas-de-atuacao',
  '/areas-de-atuacao/area-ficticia-1',
  '/profissionais',
  '/profissionais/profissional-ficticio-1',
];
const report = {
  database: databaseName,
  server: { api: apiOrigin, web: webOrigin, optimized: true },
  checks: [],
  layouts: [],
  errors: [],
  cleanup: {},
  limitations: [
    'Local fictitious fixtures and PostgreSQL/API/optimized SSR are tested; this does not validate external vendors, CMS, publishing or production.',
    'A browser run uses an available Playwright module/browser supplied by the operator; this script installs neither packages nor browsers.',
    'Viewport and solid-text checks do not certify WCAG, screen readers, physical devices or other browser engines.',
  ],
};
let operator;
let database;
let browser;
let api;
let web;
let databaseCreated = false;
let fixtureCreated = false;
let baseUrl;
let testUrl;
const childSecrets = [
  randomBytes(32).toString('hex'),
  randomBytes(32).toString('hex'),
  randomBytes(32).toString('hex'),
  randomBytes(32).toString('hex'),
];

function redact(value) {
  let text = String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, '[database]');
  for (const secret of [
    baseUrl?.password,
    baseUrl?.password ? decodeURIComponent(baseUrl.password) : '',
    ...childSecrets,
  ]) {
    if (secret) text = text.replaceAll(secret, '[redacted]');
  }
  return text;
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
        : `Check failed: ${error?.name ?? 'Error'}`,
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
  const result = { process, label, diagnostics: '' };
  const collect = (chunk) => {
    result.diagnostics = (result.diagnostics + chunk.toString()).slice(-32768);
  };
  process.stdout.on('data', collect);
  process.stderr.on('data', collect);
  process.on('error', () => {
    result.diagnostics += `\n${label} failed to start.`;
  });
  return result;
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
    !running ||
    !running.process.pid ||
    running.process.exitCode !== null ||
    running.process.signalCode !== null
  )
    return;
  const stopped = new Promise((resolve) => running.process.once('exit', resolve));
  if (process.platform === 'win32') {
    assert.ok(Number.isInteger(running.process.pid) && running.process.pid > 0);
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(running.process.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
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
    'Dedicated test ports must exclude the existing web/API ports.',
  );
  await new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', () => reject(new Error(`Test port ${port} is occupied`)));
    socket.listen(port, '127.0.0.1', () => socket.close(resolve));
  });
}

async function request(url, expected = 200, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), ...options });
  const body = await response.text();
  assert.equal(response.status, expected, `HTTP ${expected} for ${new URL(url).pathname}`);
  return { response, body };
}
async function json(path, expected = 200) {
  return JSON.parse((await request(`${apiOrigin}/api/v1${path}`, expected)).body);
}
async function html(path, expected = 200) {
  return (await request(`${webOrigin}${path}`, expected)).body;
}
async function ready(url, running, expected = 200) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (running.process.exitCode !== null)
      throw new Error(`${running.label} exited before readiness`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.arrayBuffer();
      if (response.status === expected) return;
    } catch {
      /* startup is bounded below */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.error(redact(running.diagnostics));
  throw new Error(`${running.label} readiness timed out`);
}

function png() {
  const width = 512,
    height = 384;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = x + y < width ? [220, 234, 247] : [16, 42, 67];
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[offset + c] = color[c];
    }
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

function metadata(body, path) {
  const canonical = body.match(
    /<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"[^>]*>/iu,
  )?.[1];
  assert.equal(
    canonical,
    new URL(path, process.env.NEXT_PUBLIC_SITE_URL).href,
    `Canonical ${path}`,
  );
  assert.ok((body.match(/<title>([^<]+)<\/title>/iu)?.[1] ?? '').trim(), `Title ${path}`);
  assert.match(
    body,
    /<meta\b(?=[^>]*\bname="description")(?=[^>]*\bcontent="[^"]+")[^>]*>/iu,
    `Description ${path}`,
  );
  assert.doesNotMatch(
    body,
    /password_hash|passwordHash|storage_key|refresh_token|postgres(?:ql)?:\/\//iu,
    'No internal fields in SSR',
  );
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
    let textCount = 0,
      ignoredText = 0;
    for (const element of document.querySelectorAll('body *')) {
      if (
        !visible(element) ||
        element.closest('[aria-hidden="true"], [disabled], script, style, nextjs-portal')
      )
        continue;
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .trim();
      if (!text) continue;
      const bg = background(element),
        color = parse(getComputedStyle(element).color);
      if (!bg || !color) {
        ignoredText++;
        continue;
      }
      textCount++;
      const a = luminance(blend(color, bg)),
        b = luminance(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 4.5) contrast.push({ text: text.slice(0, 80), ratio: Number(ratio.toFixed(3)) });
    }
    const labels = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')]
      .filter(visible)
      .filter(
        (field) =>
          !field.labels?.length &&
          !field.getAttribute('aria-label') &&
          !field.getAttribute('aria-labelledby'),
      )
      .map((field) => field.id);
    const images = [...document.querySelectorAll('img')].filter(visible).map((image) => ({
      alt: image.getAttribute('alt'),
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      src: image.currentSrc,
    }));
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1: [...document.querySelectorAll('h1')].map((heading) => heading.textContent),
      mains: document.querySelectorAll('main').length,
      labels,
      contrast,
      textCount,
      ignoredText,
      images,
    };
  });
}

async function layouts() {
  for (const path of routes) {
    for (const width of [320, 768, 1024, 1440, 1920]) {
      await check(`browser ${path} at ${width}`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', (error) => errors.push(redact(error.message)));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(redact(message.text()));
        });
        page.on('response', (response) => {
          if (response.status() >= 400)
            errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
        });
        try {
          const response = await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
          assert.equal(response.status(), 200);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(async () => {
            for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight) {
              window.scrollTo({ top, behavior: 'instant' });
              await new Promise((resolve) => setTimeout(resolve, 80));
            }
            window.scrollTo({ top: 0, behavior: 'instant' });
          });
          await page.waitForFunction(() =>
            [...document.images].every((image) => image.complete && image.naturalWidth > 0),
          );
          const audit = await renderedAudit(page);
          assert.ok(audit.scrollWidth <= width, 'No horizontal overflow');
          assert.equal(audit.h1.length, 1);
          assert.ok(audit.h1[0].trim());
          assert.equal(audit.mains, 1);
          assert.deepEqual(audit.labels, []);
          assert.deepEqual(audit.contrast, []);
          assert.ok(
            audit.images.every(
              (image) => image.alt !== null && image.complete && image.naturalWidth > 0,
            ),
            'Visible images loaded and have alt',
          );
          assert.equal(
            await page.locator('link[rel="canonical"]').getAttribute('href'),
            new URL(path, process.env.NEXT_PUBLIC_SITE_URL).href,
          );
          await page.keyboard.press('Tab');
          assert.match(await page.evaluate(() => document.activeElement.textContent), /Ir para/iu);
          await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => document.activeElement.tagName), 'MAIN');
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            window.scrollTo({ top: 0, behavior: 'instant' });
          });
          const label = path === '/' ? 'home' : path.replace(/^\//u, '').replaceAll('/', '-');
          const fullPath = resolve(evidence, `${label}-${width}.png`),
            viewportPath = resolve(evidence, `${label}-${width}-viewport.png`);
          await page.screenshot({ path: fullPath, fullPage: true });
          await page.screenshot({ path: viewportPath });
          const bytes = readFileSync(fullPath);
          assert.equal(bytes.readUInt32BE(16), width);
          assert.deepEqual(errors, [], 'No browser, console or HTTP failures');
          report.layouts.push({
            path,
            width,
            height: 1000,
            audit,
            png: {
              fullPath,
              viewportPath,
              width: bytes.readUInt32BE(16),
              height: bytes.readUInt32BE(20),
            },
          });
        } catch (error) {
          const label = path === '/' ? 'home' : path.replace(/^\//u, '').replaceAll('/', '-');
          await page
            .screenshot({
              path: resolve(evidence, `${label}-${width}-failure.png`),
              fullPage: true,
            })
            .catch(() => undefined);
          throw error;
        } finally {
          await page.close();
        }
      });
    }
  }
}

async function domainChecks() {
  await check('seeded API and SSR metadata for six institutional templates', async () => {
    const areas = await json('/practice-areas'),
      people = await json('/professionals'),
      articles = await json('/articles');
    assert.equal(areas.meta.total, 5);
    assert.equal(people.meta.total, 4);
    assert.equal(articles.meta.total, 12);
    for (const path of routes) metadata(await html(path), path);
    assert.ok((await html('/areas-de-atuacao')).includes(areas.data[0].name));
    assert.ok((await html('/profissionais')).includes(people.data[0].name));
    for (const item of [
      await json('/practice-areas/area-ficticia-1'),
      await json('/professionals/profissional-ficticio-1'),
    ])
      assert.ok(item.id);
    return {
      areas: areas.meta.total,
      professionals: people.meta.total,
      publishedArticles: articles.meta.total,
    };
  });
  await check('missing slugs return real HTTP 404 in API and SSR', async () => {
    for (const [apiPath, webPath] of [
      ['/practice-areas/f4-unknown-slug', '/areas-de-atuacao/f4-unknown-slug'],
      ['/professionals/f4-unknown-slug', '/profissionais/f4-unknown-slug'],
    ]) {
      assert.equal((await json(apiPath, 404)).error.code, 'NOT_FOUND');
      const body = await html(webPath, 404);
      assert.match(body, /não encontrad|n[aã]o existe|indispon[ií]vel/iu);
      assert.doesNotMatch(body, /postgres|Prisma|stack trace/iu);
    }
  });
  await check('draft, scheduled and archived article titles are absent from home', async () => {
    await database.query(
      "UPDATE articles SET featured=true WHERE status <> 'PUBLISHED' AND is_mock=true",
    );
    const hidden = await database.query("SELECT title FROM articles WHERE status <> 'PUBLISHED'");
    const body = await html('/');
    assert.equal(hidden.rows.length, 8);
    for (const row of hidden.rows) assert.ok(!body.includes(row.title));
    assert.equal((await json('/articles?featured=true')).meta.total, 3);
  });
  await check('catalogue pagination handles empty distant pages and invalid input', async () => {
    for (const [apiPath, webPath] of [
      ['/practice-areas', '/areas-de-atuacao'],
      ['/professionals', '/profissionais'],
    ]) {
      const distant = await json(`${apiPath}?page=100000&limit=12`);
      assert.deepEqual(distant.data, []);
      assert.equal(distant.meta.page, 100000);
      const empty = await html(`${webPath}?pagina=100000`);
      const main = empty.match(/<main\b[^>]*>([\s\S]*?)<\/main>/iu)?.[1] ?? '';
      assert.match(main, /nenhum|nenhuma|dispon[ií]ve|prepara[çc][aã]o/iu);
      metadata(empty, webPath);
      const first = (await json(apiPath)).data[0];
      const invalid = await html(`${webPath}?pagina=invalid`);
      assert.ok(invalid.includes(first.name), 'Invalid page falls back to first page');
      metadata(invalid, webPath);
    }
  });
  await check('optimized Next image resizes an owned public raster fixture', async () => {
    const media = (await json('/professionals/profissional-ficticio-1')).photo;
    assert.equal(media.url, fixtureUrl);
    const response = await fetch(
      `${webOrigin}/_next/image?url=${encodeURIComponent(fixtureUrl)}&w=256&q=75`,
      { headers: { Accept: 'image/png' }, signal: AbortSignal.timeout(15000) },
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^image\/png/iu);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 192);
    const body = await html('/profissionais/profissional-ficticio-1');
    assert.ok(body.includes('_next/image'));
    assert.ok(body.includes(`f4-fixture-${id}`));
    return { source: '512x384 PNG', resized: '256x192 PNG' };
  });
  if (browser) await layouts();
  if (browser)
    await check(
      'institutional navigation and search work with keyboard on mobile and desktop',
      async () => {
        const page = await browser.newPage({ viewport: { width: 320, height: 1000 } });
        try {
          await page.goto(webOrigin, { waitUntil: 'networkidle' });
          const mobile = page.getByRole('button', { name: 'Abrir menu de navegação', exact: true });
          await mobile.focus();
          await page.keyboard.press('Enter');
          const drawer = page.getByRole('dialog', { name: 'Menu de navegação', exact: true });
          await drawer.waitFor({ state: 'visible' });
          assert.equal(
            await drawer
              .getByRole('link', { name: 'O escritório', exact: true })
              .getAttribute('href'),
            '/o-escritorio',
          );
          for (let index = 0; index < 20; index++) {
            await page.keyboard.press('Tab');
            assert.ok(
              await drawer.evaluate((element) => element.contains(document.activeElement)),
              'Mobile dialog contains keyboard focus',
            );
          }
          await page.keyboard.press('Escape');
          await drawer.waitFor({ state: 'hidden' });
          assert.ok(await mobile.evaluate((element) => element === document.activeElement));
          const search = page.getByRole('button', { name: 'Buscar', exact: true });
          await search.focus();
          await page.keyboard.press('Enter');
          const overlay = page.getByRole('dialog', { name: 'Buscar no site', exact: true });
          await overlay.waitFor({ state: 'visible' });
          await overlay
            .getByRole('searchbox', { name: 'O que você procura?' })
            .fill('exemplo fictício');
          await page.keyboard.press('Escape');
          await overlay.waitFor({ state: 'hidden' });
          assert.ok(await search.evaluate((element) => element === document.activeElement));
          await page.setViewportSize({ width: 1440, height: 1000 });
          const toggle = page.getByRole('button', { name: 'Áreas de atuação', exact: true });
          await toggle.focus();
          await page.keyboard.press('ArrowDown');
          const first = page
            .locator('.site-mega-menu')
            .getByRole('link', { name: 'Todas as áreas', exact: true });
          await first.waitFor({ state: 'visible' });
          assert.ok(await first.evaluate((element) => element === document.activeElement));
          await page.keyboard.press('Escape');
          assert.ok(await toggle.evaluate((element) => element === document.activeElement));
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        } finally {
          await page.close();
        }
      },
    );

  const marker = `QA F4 ${id.slice(0, 8)}`;
  const document = (text) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  await check('owned PostgreSQL changes appear in API and new SSR without rebuilding', async () => {
    await database.query(
      "UPDATE practice_areas SET name=$1, summary=$2, description=$3::jsonb, services=$4::jsonb WHERE slug='area-ficticia-1' AND is_mock=true",
      [
        `${marker} area`,
        `${marker} summary`,
        JSON.stringify(document(`${marker} description`)),
        JSON.stringify([`${marker} service`]),
      ],
    );
    await database.query(
      "UPDATE professionals SET name=$1, bio=$2::jsonb, education=$3::jsonb, experience=$4::jsonb WHERE slug='profissional-ficticio-1' AND is_mock=true",
      [
        `${marker} person`,
        JSON.stringify(document(`${marker} biography`)),
        JSON.stringify([`${marker} education`]),
        JSON.stringify([`${marker} experience`]),
      ],
    );
    await database.query(
      "UPDATE site_settings SET site_name=$1, public_email=$2 WHERE id='site' AND is_mock=true",
      [`${marker} office`, 'qa-f4@example.invalid'],
    );
    const office = (
      await database.query("SELECT sections FROM pages WHERE slug='o-escritorio' AND is_mock=true")
    ).rows[0];
    const sections = office.sections.map((section, index) =>
      index === 0 ? { ...section, body: document(`${marker} office body`) } : section,
    );
    await database.query(
      "UPDATE pages SET sections=$1::jsonb, seo_title=$2, seo_description=$3 WHERE slug='o-escritorio' AND is_mock=true",
      [JSON.stringify(sections), `${marker} metadata`, `${marker} description office`],
    );
    const area = await json('/practice-areas/area-ficticia-1'),
      person = await json('/professionals/profissional-ficticio-1'),
      settings = await json('/settings'),
      officePage = await json('/pages/o-escritorio');
    assert.equal(area.name, `${marker} area`);
    assert.equal(person.name, `${marker} person`);
    assert.equal(settings.siteName, `${marker} office`);
    assert.equal(officePage.seoTitle, `${marker} metadata`);
    const areaHtml = await html('/areas-de-atuacao/area-ficticia-1'),
      personHtml = await html('/profissionais/profissional-ficticio-1'),
      homeHtml = await html('/'),
      officeHtml = await html('/o-escritorio');
    for (const value of [
      `${marker} area`,
      `${marker} summary`,
      `${marker} description`,
      `${marker} service`,
    ])
      assert.ok(areaHtml.includes(value), value);
    for (const value of [
      `${marker} person`,
      `${marker} biography`,
      `${marker} education`,
      `${marker} experience`,
    ])
      assert.ok(personHtml.includes(value), value);
    assert.ok(homeHtml.includes(`${marker} office`));
    assert.ok(homeHtml.includes('qa-f4@example.invalid'));
    assert.ok(officeHtml.includes(`${marker} office body`));
    assert.match(officeHtml, new RegExp(`<title>${marker} metadata`));
  });
  await check(
    'published rich documents preserve semantic marks and escape text in real SSR',
    async () => {
      const literal = '<script>globalThis.__f4_xss_fixture=1</script>';
      const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
      const paragraph = (value) => ({ type: 'paragraph', content: [text(value)] });
      const rich = {
        type: 'doc',
        content: [
          ...[2, 3, 4].map((level) => ({
            type: 'heading',
            attrs: { level },
            content: [text(`${marker} heading ${level}`)],
          })),
          {
            type: 'paragraph',
            content: [
              text(`${marker} bold`, [{ type: 'bold' }]),
              text(' / '),
              text(`${marker} italic`, [{ type: 'italic' }]),
              { type: 'hardBreak' },
              text(`${marker} internal link`, [{ type: 'link', attrs: { href: '/o-escritorio' } }]),
            ],
          },
          paragraph(literal),
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [paragraph(`${marker} list`)] }],
          },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [{ type: 'listItem', content: [paragraph(`${marker} ordered`)] }],
          },
          { type: 'blockquote', content: [paragraph(`${marker} quotation`)] },
          { type: 'codeBlock', attrs: { language: 'text' }, content: [text(`${marker} code`)] },
          { type: 'horizontalRule' },
        ],
      };
      const office = (
        await database.query(
          "SELECT sections FROM pages WHERE slug='o-escritorio' AND is_mock=true",
        )
      ).rows[0];
      const sections = office.sections.map((section, index) =>
        index === 0 ? { ...section, body: rich } : section,
      );
      await database.query(
        "UPDATE pages SET sections=$1::jsonb WHERE slug='o-escritorio' AND is_mock=true",
        [JSON.stringify(sections)],
      );
      assert.deepEqual((await json('/pages/o-escritorio')).sections[0].body, rich);
      const body = await html('/o-escritorio');
      assert.ok(body.includes('&lt;script&gt;globalThis.__f4_xss_fixture=1&lt;/script&gt;'));
      assert.ok(!body.includes(literal), 'Literal script is never an executable HTML node');
      assert.ok(body.includes(`<strong>${marker} bold</strong>`));
      assert.ok(body.includes(`<em>${marker} italic</em>`));
      assert.ok(body.includes(`<a href="/o-escritorio">${marker} internal link</a>`));
      if (browser) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        try {
          await page.goto(`${webOrigin}/o-escritorio`, { waitUntil: 'networkidle' });
          for (const level of [2, 3, 4])
            assert.equal(
              await page
                .locator(`h${level}`)
                .filter({ hasText: `${marker} heading ${level}` })
                .count(),
              1,
            );
          assert.equal(await page.getByText(literal, { exact: true }).count(), 1);
          assert.equal(await page.evaluate(() => globalThis.__f4_xss_fixture), undefined);
          assert.deepEqual((await renderedAudit(page)).contrast, []);
          await page.screenshot({
            path: resolve(evidence, 'office-rich-document-1440.png'),
            fullPage: true,
          });
        } finally {
          await page.close();
        }
      }
    },
  );
  await check(
    'home independently finds older featured articles and guides beyond fifty newer articles',
    async () => {
      const oldFeatured = `${marker} older featured`,
        oldGuide = `${marker} older guide`;
      await database.query(
        "UPDATE articles SET published_at='2020-01-01T12:00:00Z' WHERE status='PUBLISHED' AND (featured=true OR type='GUIDE') AND is_mock=true",
      );
      await database.query(
        "UPDATE articles SET title=$1, published_at='2021-01-01T12:00:00Z' WHERE slug='conteudo-ficticio-01' AND is_mock=true",
        [oldFeatured],
      );
      await database.query(
        "UPDATE articles SET title=$1, published_at='2021-01-01T12:00:00Z' WHERE slug='conteudo-ficticio-06' AND is_mock=true",
        [oldGuide],
      );
      for (let index = 0; index < 55; index++) {
        const inserted = await database.query(
          "INSERT INTO articles (id,slug,title,excerpt,content,type,status,author_id,created_by_id,featured,reading_time_minutes,published_at,is_mock,updated_at) SELECT $1,$2,$3,excerpt,content,'ARTICLE','PUBLISHED',author_id,created_by_id,false,reading_time_minutes,NOW()-($4::integer * INTERVAL '1 second'),true,NOW() FROM articles WHERE slug='conteudo-ficticio-12' AND is_mock=true RETURNING id",
          [randomUUID(), `f4-${id}-${index}`, `${marker} recent ${index}`, index + 1],
        );
        assert.equal(inserted.rowCount, 1);
      }
      const recent = await json('/articles?limit=50');
      assert.equal(recent.meta.total, 67);
      assert.equal(recent.data.length, 50);
      assert.ok(!recent.data.some((item) => item.title === oldFeatured || item.title === oldGuide));
      assert.ok(
        (await json('/articles?featured=true&limit=3')).data.some(
          (item) => item.title === oldFeatured,
        ),
      );
      assert.ok(
        (await json('/articles?type=GUIDE&limit=3')).data.some((item) => item.title === oldGuide),
      );
      const body = await html('/');
      assert.ok(body.includes(oldFeatured), 'Older featured content remains in home');
      assert.ok(body.includes(oldGuide), 'Older guide remains in home');
      if (browser) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        try {
          await page.goto(webOrigin, { waitUntil: 'networkidle' });
          assert.ok(await page.getByText(oldFeatured, { exact: true }).first().isVisible());
          assert.ok(await page.getByText(oldGuide, { exact: true }).first().isVisible());
          await page.screenshot({
            path: resolve(evidence, 'home-many-articles-1440.png'),
            fullPage: true,
          });
        } finally {
          await page.close();
        }
      }
      return { publishedArticles: 67, newerNonFeaturedArticles: 55 };
    },
  );
  await check(
    'inactive area/professional and draft office are hidden with SSR HTTP 404',
    async () => {
      await database.query(
        "UPDATE practice_areas SET is_active=false WHERE slug='area-ficticia-1' AND is_mock=true",
      );
      await database.query(
        "UPDATE professionals SET is_active=false WHERE slug='profissional-ficticio-1' AND is_mock=true",
      );
      await database.query(
        "UPDATE pages SET status='DRAFT' WHERE slug='o-escritorio' AND is_mock=true",
      );
      try {
        await json('/practice-areas/area-ficticia-1', 404);
        await json('/professionals/profissional-ficticio-1', 404);
        await json('/pages/o-escritorio', 404);
        await html('/areas-de-atuacao/area-ficticia-1', 404);
        await html('/profissionais/profissional-ficticio-1', 404);
        await html('/o-escritorio', 404);
        assert.ok(!(await html('/areas-de-atuacao')).includes(`${marker} area`));
        assert.ok(!(await html('/profissionais')).includes(`${marker} person`));
      } finally {
        await database.query(
          "UPDATE practice_areas SET is_active=true WHERE slug='area-ficticia-1' AND is_mock=true",
        );
        await database.query(
          "UPDATE professionals SET is_active=true WHERE slug='profissional-ficticio-1' AND is_mock=true",
        );
        await database.query(
          "UPDATE pages SET status='PUBLISHED' WHERE slug='o-escritorio' AND is_mock=true",
        );
      }
    },
  );
  await check('empty catalogues return API zero and usable SSR states', async () => {
    await database.query('UPDATE practice_areas SET is_active=false WHERE is_mock=true');
    await database.query('UPDATE professionals SET is_active=false WHERE is_mock=true');
    try {
      for (const [apiPath, webPath] of [
        ['/practice-areas', '/areas-de-atuacao'],
        ['/professionals', '/profissionais'],
      ]) {
        const result = await json(apiPath);
        assert.equal(result.meta.total, 0);
        assert.deepEqual(result.data, []);
        const body = await html(webPath);
        assert.match(body, /nenhum|nenhuma|dispon[ií]ve|prepara[çc][aã]o/iu);
        metadata(body, webPath);
        assert.ok(!body.includes(`${marker} area`));
        assert.ok(!body.includes(`${marker} person`));
      }
    } finally {
      await database.query('UPDATE practice_areas SET is_active=true WHERE is_mock=true');
      await database.query('UPDATE professionals SET is_active=true WHERE is_mock=true');
    }
  });
  await check(
    'API unavailable returns safe SSR HTTP 503 on every institutional route',
    async () => {
      await stop(api);
      api = undefined;
      for (const path of routes) {
        const { body, response } = await request(`${webOrigin}${path}`, 503);
        assert.ok(body.includes('Conteúdo temporariamente indisponível'));
        assert.equal(response.headers.get('retry-after'), '30');
        assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
        assert.doesNotMatch(body, /postgres|Prisma|ECONNREFUSED|DATABASE_URL|stack trace/iu);
      }
    },
  );
  await check('API recovery restores real SSR after the outage', async () => {
    api = startApi();
    await ready(`${apiOrigin}/health`, api);
    const body = await html('/');
    assert.ok(body.includes(`${marker} office`));
  });
}

let environment;
function startApi() {
  return child(
    process.execPath,
    [resolve(apiRoot, 'dist/main.js')],
    apiRoot,
    environment,
    'isolated API',
  );
}

async function cleanup() {
  await browser?.close().catch(() => undefined);
  browser = undefined;
  await stop(web);
  await stop(api);
  report.cleanup.processesStopped = true;
  await database?.end().catch(() => undefined);
  database = undefined;
  if (databaseCreated) {
    assert.match(databaseName, /^filaretti_f4_test_[a-f\d]{32}$/u);
    assert.notEqual(baseUrl.pathname, `/${databaseName}`);
    try {
      await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      report.cleanup.databaseRemoved = true;
      databaseCreated = false;
    } catch {
      report.cleanup.databaseRemoved = false;
      report.errors.push({
        check: 'cleanup',
        message: `Could not remove owned database ${databaseName}`,
      });
    }
  }
  await operator?.end().catch(() => undefined);
  if (fixtureCreated) {
    assert.equal(fixtureFile, resolve(webRoot, `public/media/public/f4-fixture-${id}.png`));
    try {
      unlinkSync(fixtureFile);
      fixtureCreated = false;
      report.cleanup.rasterRemoved = true;
    } catch {
      report.cleanup.rasterRemoved = false;
      report.errors.push({
        check: 'cleanup',
        message: 'Could not remove the owned fixture raster.',
      });
    }
  }
}

try {
  if (process.env.APP_ENV !== 'development') throw new Error('Require APP_ENV=development');
  if (!process.env.DATABASE_URL || !process.env.npm_execpath)
    throw new Error('Run through pnpm with local DATABASE_URL configured');
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
  assert.ok(process.env.NEXT_PUBLIC_SITE_URL, 'Public canonical configuration is required');
  assert.notEqual(apiPort, webPort);
  await freePort(apiPort);
  await freePort(webPort);
  let playwright;
  if (!httpOnly) {
    try {
      playwright = process.env.PLAYWRIGHT_MODULE_PATH
        ? apiRequire(process.env.PLAYWRIGHT_MODULE_PATH)
        : webRequire('playwright');
    } catch {
      throw new Error(
        'Playwright unavailable: set PLAYWRIGHT_MODULE_PATH to an installed module, or explicitly use --http-only. No dependency/browser is installed automatically.',
      );
    }
    browser = await playwright.chromium.launch({
      channel: process.env.F4_TEST_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    report.browser = {
      channel: process.env.F4_TEST_BROWSER_CHANNEL ?? 'msedge',
      version: browser.version(),
    };
  } else
    report.limitations.push(
      'Explicit --http-only: no browser, keyboard, screenshots or viewport checks were executed.',
    );
  mkdirSync(evidence, { recursive: true });
  testUrl = new URL(baseUrl);
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
    JWT_SECRET: childSecrets[0],
    REFRESH_TOKEN_SECRET: childSecrets[1],
    PREVIEW_SECRET: childSecrets[2],
    REVALIDATION_SECRET: childSecrets[3],
    COOKIE_SECURE: 'false',
    STORAGE_DRIVER: 'local',
    R2_ENABLED: 'false',
    RESEND_ENABLED: 'false',
    TURNSTILE_ENABLED: 'false',
  };
  operator = new Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
  await operator.connect();
  assert.match(databaseName, /^filaretti_f4_test_[a-f\d]{32}$/u);
  await operator.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  await command(['exec', 'prisma', 'migrate', 'deploy'], environment, 'isolated migrations');
  await command(
    ['exec', 'tsx', 'prisma/seed-development.ts'],
    environment,
    'isolated fictitious seed',
  );
  database = new Client({ connectionString: testUrl.href, connectionTimeoutMillis: 5000 });
  await database.connect();
  assert.equal(
    (await database.query('SELECT current_database() AS name')).rows[0].name,
    databaseName,
  );
  const raster = png();
  mkdirSync(dirname(fixtureFile), { recursive: true });
  writeFileSync(fixtureFile, raster, { flag: 'wx' });
  fixtureCreated = true;
  const mediaId = randomUUID();
  await database.query(
    "INSERT INTO media (id,owner_id,visibility,storage_key,public_url,mime_type,size,alt,source,license,is_mock,updated_at) VALUES ($1,'10000000-0000-4000-8000-000000000001','PUBLIC',$2,$3,'image/png',$4,'Raster fictício de teste F4','fixture local','somente teste',true,NOW())",
    [mediaId, `f4-test/${id}.png`, fixtureUrl, raster.length],
  );
  await database.query(
    "UPDATE professionals SET photo_media_id=$1 WHERE slug='profissional-ficticio-1' AND is_mock=true",
    [mediaId],
  );
  await database.query(
    "UPDATE articles SET cover_media_id=$1 WHERE slug='conteudo-ficticio-01' AND is_mock=true",
    [mediaId],
  );
  api = startApi();
  await ready(`${apiOrigin}/health`, api);
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
    {
      ...environment,
      NODE_ENV: 'production',
      API_INTERNAL_URL: apiOrigin,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
    'isolated optimized web',
  );
  await ready(webOrigin, web);
  await domainChecks();
} catch (error) {
  const message =
    error instanceof assert.AssertionError
      ? redact(error.message)
      : redact(error.message ?? 'Institutional test setup failed');
  report.errors.push({ check: 'setup/runtime', message });
  console.error(message);
} finally {
  await cleanup().catch(() => {
    report.errors.push({
      check: 'cleanup',
      message: 'Owned fixture cleanup failed; inspect the local report.',
    });
  });
  mkdirSync(dirname(reportPath), { recursive: true });
  report.passed = report.errors.length === 0 && report.checks.length > 0;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      layouts: report.layouts.length,
      failures: report.errors.length,
      cleanup: report.cleanup,
      report: '.local/f4-smoke.json',
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
