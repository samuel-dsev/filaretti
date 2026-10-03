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
// database/processes/raster/PDF; it never migrates, reseeds or resets an existing DB.
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
const apiPort = Number(process.env.F5_TEST_API_PORT ?? 3015);
const webPort = Number(process.env.F5_TEST_WEB_PORT ?? 3014);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const evidence = resolve(root, '.local/f5-evidence');
const reportPath = resolve(root, '.local/f5-smoke.json');
const id = randomUUID();
const databaseName = `filaretti_f5_test_${id.replaceAll('-', '')}`;
const fixtureUrl = `/media/public/f5-fixture-${id}.png`;
const fixtureFile = resolve(webRoot, `public${fixtureUrl}`);
const pdfUrl = `/media/public/f5-fixture-${id}.pdf`;
const pdfFile = resolve(webRoot, `public${pdfUrl}`);
const articleSlug = 'conteudo-ficticio-01';
const guideSlug = 'conteudo-ficticio-06';
const marker = `QA F5 ${id.slice(0, 8)}`;
const routes = ['/conteudos', `/conteudos/${articleSlug}`, `/conteudos/${guideSlug}`];
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
    'Local fictitious fixtures and PostgreSQL/API/optimized SSR are tested; this does not validate external vendors, CMS mutations, scheduled workers or production.',
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
let pdfCreated = false;
let pdfMediaId;
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
  if (process.pid) report.ownedProcesses.push({ label, pid: process.pid });
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

function text(value, marks) {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) };
}
function paragraph(value) {
  return { type: 'paragraph', content: [text(value)] };
}
function richDocument() {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [text('Direitos, ação e informação')] },
      paragraph('Conteúdo inteiramente fictício para QA editorial local.'),
      { type: 'heading', attrs: { level: 3 }, content: [text('Subseção de leitura')] },
      {
        type: 'paragraph',
        content: [
          text(`${marker} destaque`, [{ type: 'bold' }]),
          text(' / '),
          text(`${marker} ênfase`, [{ type: 'italic' }]),
          { type: 'hardBreak' },
          text('Link institucional', [{ type: 'link', attrs: { href: '/o-escritorio' } }]),
          text(' / '),
          text('Link seguro externo', [
            { type: 'link', attrs: { href: 'https://example.invalid/f5' } },
          ]),
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [text('Direitos, ação e informação')] },
      paragraph('<script>globalThis.__f5_xss_fixture=1</script>'),
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph(`${marker} item`)] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [{ type: 'listItem', content: [paragraph(`${marker} ordenado`)] }],
      },
      { type: 'blockquote', content: [paragraph(`${marker} citação`)] },
      { type: 'codeBlock', attrs: { language: 'text' }, content: [text(`${marker} código`)] },
      { type: 'heading', attrs: { level: 2 }, content: [text('法律 ⚖️ ação e direitos')] },
      paragraph('PalavraExtensaFictícia'.repeat(12)),
      { type: 'horizontalRule' },
    ],
  };
}

// Small valid single-page PDF, created as an owned fixture and removed after QA.
function pdf() {
  const content = 'BT /F1 14 Tf 40 180 Td (F5 - Guia ficticio para teste local) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}

async function prepareFixtures() {
  await database.query(
    'UPDATE articles SET content=$1::jsonb,title=$2,excerpt=$3,reading_time_minutes=4 WHERE slug=$4 AND is_mock=true',
    [
      JSON.stringify(richDocument()),
      `${marker} — leitura editorial fictícia`,
      'Resumo fictício para verificar leitura, autoria, datas, sumário e relações.',
      articleSlug,
    ],
  );
  await database.query(
    'UPDATE articles SET content=$1::jsonb,title=$2 WHERE slug=$3 AND is_mock=true',
    [JSON.stringify(richDocument()), `${marker} — guia PDF fictício`, guideSlug],
  );
  const source = (await database.query('SELECT id FROM articles WHERE slug=$1', [articleSlug]))
    .rows[0].id;
  // Eighteen matching articles require a second page while other seeded records
  // remain present to prove the filter intersection, rather than independent ORs.
  for (let index = 0; index < 17; index++) {
    const cloneId = randomUUID();
    await database.query(
      "INSERT INTO articles (id,slug,title,excerpt,content,type,status,author_id,created_by_id,featured,reading_time_minutes,published_at,is_mock,updated_at) SELECT $1,$2,$3,excerpt,content,type,status,author_id,created_by_id,false,reading_time_minutes,published_at-($4::integer * INTERVAL '1 hour'),true,NOW() FROM articles WHERE id=$5 RETURNING id",
      [
        cloneId,
        `f5-${id}-${index}`,
        `${marker} — publicação relacionada ${index + 1}`,
        index + 1,
        source,
      ],
    );
    for (const [table, column] of [
      ['article_categories', 'category_id'],
      ['article_tags', 'tag_id'],
      ['article_practice_areas', 'practice_area_id'],
    ]) {
      await database.query(
        `INSERT INTO ${table} (article_id,${column}) SELECT $1,${column} FROM ${table} WHERE article_id=$2`,
        [cloneId, source],
      );
    }
  }
  await database.query(
    "INSERT INTO articles (id,slug,title,excerpt,content,type,status,author_id,created_by_id,featured,reading_time_minutes,published_at,is_mock,updated_at) SELECT $1,$2,$3,excerpt,content,'ARTICLE','PUBLISHED',author_id,created_by_id,true,reading_time_minutes,'2099-01-01T12:00:00Z',true,NOW() FROM articles WHERE id=$4",
    [randomUUID(), `f5-future-${id}`, `${marker} — publicação futura oculta`, source],
  );
}

const combinedWeb =
  '/conteudos?area=area-ficticia-1&categoria=categoria-ficticia-1&autor=profissional-ficticio-1&tag=tag-ficticia-1&tipo=ARTICLE&ano=2026&ordem=oldest';
const combinedApi =
  '/articles?area=area-ficticia-1&category=categoria-ficticia-1&author=profissional-ficticio-1&tag=tag-ficticia-1&type=ARTICLE&year=2026&sort=oldest';

async function browserLayouts() {
  for (const path of [...routes, `${combinedWeb}&pagina=2`]) {
    for (const width of [375, 768, 1024, 1440, 1920]) {
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
        const label = path.includes('?')
          ? 'conteudos-filtrados-pagina-2'
          : path.replace(/^\//u, '').replaceAll('/', '-');
        try {
          assert.equal(
            (await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' })).status(),
            200,
          );
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
          );
          const duplicates = await page.evaluate(() => {
            const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
            return ids.filter((value, index) => ids.indexOf(value) !== index);
          });
          assert.deepEqual(duplicates, [], 'DOM IDs remain unique');
          await page.keyboard.press('Tab');
          assert.match(await page.evaluate(() => document.activeElement.textContent), /Ir para/iu);
          await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => document.activeElement.tagName), 'MAIN');
          await page.evaluate(() => {
            document.activeElement?.blur();
            window.scrollTo({ top: 0, behavior: 'instant' });
          });
          const fullPath = resolve(evidence, `${label}-${width}.png`);
          const viewportPath = resolve(evidence, `${label}-${width}-viewport.png`);
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
  await check('real PostgreSQL API and optimized SSR editorial index/detail/guide', async () => {
    const published = await json('/articles?limit=50');
    assert.equal(published.meta.total, 29);
    for (const path of routes) metadata(await html(path), path);
    for (const slug of [articleSlug, guideSlug]) {
      const item = await json(`/articles/${slug}`);
      const body = await html(`/conteudos/${slug}`);
      for (const value of [
        item.title,
        item.excerpt,
        item.author.name,
        item.categories[0].name,
        item.practiceAreas[0].name,
      ])
        assert.ok(body.includes(value), value);
      assert.ok(body.includes(`/profissionais/${item.author.slug}`));
      assert.ok(body.includes(`/areas-de-atuacao/${item.practiceAreas[0].slug}`));
      assert.ok(body.includes('<time'));
      assert.match(body, /min/iu);
    }
    return { published: published.meta.total, pageSize: (await json('/articles')).meta.limit };
  });
  await check(
    'Home area and professional editorial links open the published reading route',
    async () => {
      for (const path of [
        '/',
        '/areas-de-atuacao/area-ficticia-1',
        '/profissionais/profissional-ficticio-1',
      ]) {
        const body = await html(path);
        assert.ok(body.includes(`href="/conteudos/${articleSlug}"`), `Editorial link in ${path}`);
        if (browser) {
          const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
          try {
            await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
            await page.locator(`a[href="/conteudos/${articleSlug}"]`).first().click();
            await page.waitForURL(`${webOrigin}/conteudos/${articleSlug}`);
            assert.equal(
              await page.locator('h1').innerText(),
              `${marker} — leitura editorial fictícia`,
            );
          } finally {
            await page.close();
          }
        } else await html(`/conteudos/${articleSlug}`);
      }
    },
  );
  await check(
    'editorial facets contain real public catalog values and exclude hidden-only values',
    async () => {
      const filters = await json('/editorial/filters');
      assert.equal(filters.areas.length, 5);
      assert.equal(filters.categories.length, 6);
      assert.equal(filters.authors.length, 4);
      assert.equal(filters.tags.length, 12);
      assert.deepEqual(filters.years, [2026]);
      const body = await html('/conteudos');
      for (const [key, name] of [
        ['areas', 'area'],
        ['categories', 'categoria'],
        ['authors', 'autor'],
        ['tags', 'tag'],
      ]) {
        for (const item of filters[key])
          assert.ok(body.includes(`value="${item.slug}"`), `Catalog option ${name}:${item.slug}`);
      }
      for (const slug of ['tag-ficticia-13', 'tag-ficticia-17', 'tag-ficticia-20'])
        assert.ok(!body.includes(`value="${slug}"`));
      assert.ok(!body.includes('value="2099"'));
    },
  );
  await check(
    'combined filters and second page have exact API intersection and public URL state',
    async () => {
      for (const number of [1, 2]) {
        const expected = await json(`${combinedApi}&page=${number}&limit=12`);
        assert.equal(expected.meta.total, 18);
        assert.equal(expected.meta.pages, 2);
        assert.equal(expected.data.length, number === 1 ? 12 : 6);
        const path = `${combinedWeb}&pagina=${number}`;
        const body = await html(path);
        for (const item of expected.data)
          assert.ok(body.includes(`/conteudos/${item.slug}`), item.slug);
        metadata(body, '/conteudos');
        if (browser) {
          const page = await browser.newPage();
          try {
            await page.goto(`${webOrigin}${path}`, { waitUntil: 'networkidle' });
            const actual = await page
              .locator('main a[href^="/conteudos/"]')
              .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
            assert.deepEqual(
              actual.sort(),
              expected.data.map((item) => `/conteudos/${item.slug}`).sort(),
            );
            for (const [name, value] of new URLSearchParams(combinedWeb.split('?')[1])) {
              assert.equal(
                await page.locator(`form [name="${name}"]`).inputValue(),
                value,
                `Filter ${name} reopens from URL`,
              );
            }
            const snapshot = await page.locator('main').innerText();
            await page.reload({ waitUntil: 'networkidle' });
            assert.equal(
              await page.locator('main').innerText(),
              snapshot,
              'Reload preserves shared results',
            );
            const next = page
              .locator('main nav a')
              .filter({ hasText: number === 1 ? /Próxima/iu : /Anterior/iu })
              .first();
            assert.ok(await next.count(), 'Pagination has a usable link');
            const href = await next.getAttribute('href');
            for (const [name, value] of new URLSearchParams(combinedWeb.split('?')[1]))
              assert.equal(
                new URL(href, webOrigin).searchParams.get(name),
                value,
                `Pagination preserves ${name}`,
              );
          } finally {
            await page.close();
          }
        }
      }
    },
  );
  await check('type ARTICLE UPDATE GUIDE filtering stays separate and public', async () => {
    for (const type of ['ARTICLE', 'UPDATE', 'GUIDE']) {
      const expected = await json(`/articles?type=${type}&limit=12`);
      assert.ok(expected.data.length > 0);
      assert.ok(expected.data.every((item) => item.type === type));
      const body = await html(`/conteudos?tipo=${type}`);
      for (const item of expected.data) assert.ok(body.includes(`/conteudos/${item.slug}`));
    }
  });
  await check(
    'draft scheduled archived and future PUBLISHED records stay hidden with detail 404',
    async () => {
      const hidden = (
        await database.query(
          "SELECT slug,title FROM articles WHERE status <> 'PUBLISHED' OR published_at > NOW() ORDER BY slug",
        )
      ).rows;
      assert.equal(hidden.length, 9);
      const bodies = await Promise.all(
        [
          '/',
          '/conteudos',
          '/areas-de-atuacao/area-ficticia-1',
          '/profissionais/profissional-ficticio-1',
        ].map((path) => html(path)),
      );
      for (const item of hidden) {
        assert.equal((await json(`/articles/${item.slug}`, 404)).error.code, 'NOT_FOUND');
        await html(`/conteudos/${item.slug}`, 404);
        for (const body of bodies) assert.ok(!body.includes(`/conteudos/${item.slug}`));
      }
    },
  );
  await check(
    'unknown detail and empty/distant/invalid filter pages keep safe statuses',
    async () => {
      await json('/articles/f5-missing-slug', 404);
      await html('/conteudos/f5-missing-slug', 404);
      for (const path of [
        '/conteudos?pagina=100000',
        '/conteudos?area=area-inexistente',
        '/conteudos?tipo=GUIDE&ano=2000',
      ]) {
        const body = await html(path);
        assert.match(body, /Esta página não possui resultados|Nenhum conteúdo encontrado/iu);
        metadata(body, '/conteudos');
      }
      assert.ok(
        (await html('/conteudos?pagina=invalid&tipo=invalid&ano=invalid')).includes(
          `/conteudos/${articleSlug}`,
        ),
      );
    },
  );
  await check(
    'cover raster optimization and approved public guide PDF are real served media',
    async () => {
      const item = await json(`/articles/${articleSlug}`);
      assert.equal(item.cover.url, fixtureUrl);
      const optimized = await fetch(
        `${webOrigin}/_next/image?url=${encodeURIComponent(fixtureUrl)}&w=256&q=75`,
        { headers: { Accept: 'image/png' }, signal: AbortSignal.timeout(15000) },
      );
      assert.equal(optimized.status, 200);
      const bytes = Buffer.from(await optimized.arrayBuffer());
      assert.equal(bytes.readUInt32BE(16), 256);
      assert.equal(bytes.readUInt32BE(20), 192);
      const guide = await json(`/articles/${guideSlug}`);
      assert.equal(guide.pdf.url, pdfUrl);
      const { response, body } = await request(`${webOrigin}${pdfUrl}`);
      assert.match(response.headers.get('content-type') ?? '', /^application\/pdf/iu);
      assert.ok(body.startsWith('%PDF-1.4'));
      assert.ok((await html(`/conteudos/${guideSlug}`)).includes(`href="${pdfUrl}"`));
      return { raster: '512x384 → 256x192 PNG', pdfBytes: Buffer.byteLength(body) };
    },
  );
  await check(
    'PRIVATE PDF references are rejected by PostgreSQL and absent from public detail/SSR',
    async () => {
      await assert.rejects(
        database.query("UPDATE media SET visibility='PRIVATE',public_url=NULL WHERE id=$1", [
          pdfMediaId,
        ]),
        (error) => error.code === '23514',
      );
      await database.query('UPDATE articles SET pdf_media_id=NULL WHERE slug=$1', [guideSlug]);
      await database.query("UPDATE media SET visibility='PRIVATE',public_url=NULL WHERE id=$1", [
        pdfMediaId,
      ]);
      try {
        await assert.rejects(
          database.query('UPDATE articles SET pdf_media_id=$1 WHERE slug=$2', [
            pdfMediaId,
            guideSlug,
          ]),
          (error) => error.code === '23514',
        );
        assert.equal((await json(`/articles/${guideSlug}`)).pdf, null);
        assert.ok(!(await html(`/conteudos/${guideSlug}`)).includes(pdfUrl));
      } finally {
        await database.query("UPDATE media SET visibility='PUBLIC',public_url=$1 WHERE id=$2", [
          pdfUrl,
          pdfMediaId,
        ]);
        await database.query('UPDATE articles SET pdf_media_id=$1 WHERE slug=$2', [
          pdfMediaId,
          guideSlug,
        ]);
      }
    },
  );
  await check(
    'rich content is escaped with semantic marks and H2 outline IDs unique for duplicate Unicode titles',
    async () => {
      const body = await html(`/conteudos/${articleSlug}`);
      assert.ok(body.includes('&lt;script&gt;globalThis.__f5_xss_fixture=1&lt;/script&gt;'));
      assert.ok(!body.includes('<script>globalThis.__f5_xss_fixture=1</script>'));
      assert.ok(body.includes(`<strong>${marker} destaque</strong>`));
      assert.ok(body.includes(`<em>${marker} ênfase</em>`));
      const headings = [...body.matchAll(/<h2\b[^>]*\bid="(leitura-[^"]+)"/gu)].map(
        (match) => match[1],
      );
      assert.equal(headings.length, 3);
      assert.equal(new Set(headings).size, 3);
      for (const value of headings) assert.ok(body.includes(`href="#${value}"`));
      assert.match(body, /<ol[^>]*start="3"/iu);
      assert.ok(body.includes('<blockquote'));
      assert.ok(body.includes('<pre'));
      if (browser) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        try {
          await page.goto(`${webOrigin}/conteudos/${articleSlug}`, { waitUntil: 'networkidle' });
          assert.equal(await page.evaluate(() => globalThis.__f5_xss_fixture), undefined);
          assert.equal(
            await page
              .getByText('<script>globalThis.__f5_xss_fixture=1</script>', { exact: true })
              .count(),
            1,
          );
          for (const value of headings) {
            await page.locator(`a[href="#${value}"]`).focus();
            await page.keyboard.press('Enter');
            await page.waitForFunction((target) => document.activeElement?.id === target, value);
            assert.equal(await page.locator(`#${value}`).getAttribute('tabindex'), '-1');
          }
          assert.equal(
            await page.locator('h3').filter({ hasText: 'Subseção de leitura' }).count(),
            1,
          );
        } finally {
          await page.close();
        }
      }
      return { outlineEntries: 3, duplicateText: true, UnicodeHeading: true };
    },
  );
  if (browser) await browserLayouts();
  if (browser)
    await check(
      'keyboard GET filters submit and reset page while retaining selected values',
      async () => {
        const page = await browser.newPage({ viewport: { width: 375, height: 1000 } });
        try {
          await page.goto(`${webOrigin}${combinedWeb}&pagina=2`, { waitUntil: 'networkidle' });
          const form = page
            .locator('form')
            .filter({ has: page.locator('[name="tipo"]') })
            .first();
          assert.equal((await form.getAttribute('method')).toLowerCase(), 'get');
          await form.locator('[name="tipo"]').selectOption('GUIDE');
          const submit = form.locator('button[type="submit"]').first();
          await submit.focus();
          await Promise.all([
            page.waitForURL((url) => url.searchParams.get('tipo') === 'GUIDE'),
            page.keyboard.press('Enter'),
          ]);
          const actual = new URL(page.url());
          assert.ok(
            !actual.searchParams.has('pagina') || actual.searchParams.get('pagina') === '1',
          );
          for (const name of ['area', 'categoria', 'autor', 'tag', 'ano', 'ordem'])
            assert.equal(
              actual.searchParams.get(name),
              new URL(`${webOrigin}${combinedWeb}`).searchParams.get(name),
            );
          assert.equal(await form.locator('[name="tipo"]').inputValue(), 'GUIDE');
          await page.screenshot({
            path: resolve(evidence, 'keyboard-filter-mobile.png'),
            fullPage: true,
          });
        } finally {
          await page.close();
        }
      },
    );
  if (browser)
    await check(
      'sharing buttons support keyboard, copied URL and clipboard-denied fallback',
      async () => {
        const page = await browser.newPage({ viewport: { width: 375, height: 1000 } });
        try {
          await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
              configurable: true,
              value: {
                writeText: async (value) => {
                  globalThis.__f5_copied = value;
                },
              },
            });
          });
          await page.goto(`${webOrigin}/conteudos/${articleSlug}`, { waitUntil: 'networkidle' });
          const copy = page.getByRole('button', { name: /copiar/iu }).first();
          await copy.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => typeof globalThis.__f5_copied === 'string');
          const copied = await page.evaluate(() => globalThis.__f5_copied);
          assert.equal(new URL(copied).pathname, `/conteudos/${articleSlug}`);
          assert.equal(new URL(copied).search, '');
          assert.equal(new URL(copied).hash, '');
          assert.match(await page.locator('[role="status"]').last().innerText(), /copiad/iu);
          await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
              configurable: true,
              value: {
                writeText: async () => {
                  throw new Error('denied');
                },
              },
            });
            document.execCommand = () => false;
          });
          await copy.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() =>
            [...document.querySelectorAll('input,textarea')].some((field) =>
              field.value?.includes('/conteudos/'),
            ),
          );
          const fallback = page.locator('input,textarea').filter({ visible: true });
          assert.ok((await fallback.count()) > 0, 'Manual copy fallback is visible');
          assert.ok(
            await fallback
              .first()
              .evaluate((element) =>
                Boolean(
                  element.labels?.length ||
                  element.getAttribute('aria-label') ||
                  element.getAttribute('aria-labelledby'),
                ),
              ),
          );
          assert.equal(
            new URL(await fallback.first().inputValue()).pathname,
            `/conteudos/${articleSlug}`,
          );
          assert.ok(
            await fallback
              .first()
              .evaluate(
                (element) =>
                  element.readOnly &&
                  element === document.activeElement &&
                  element.selectionStart === 0 &&
                  element.selectionEnd === element.value.length,
              ),
            'Manual copy field is focused and its complete URL is selected',
          );
          const audit = await renderedAudit(page);
          assert.ok(audit.scrollWidth <= 375);
          assert.deepEqual(audit.labels, []);
          assert.deepEqual(audit.contrast, []);
          await page.screenshot({
            path: resolve(evidence, 'share-copy-fallback-mobile.png'),
            fullPage: true,
          });
        } finally {
          await page.close();
        }
      },
    );
  await check(
    'stored unsafe links and script/embed nodes are rejected before SSR rendering',
    async () => {
      const invalid = [
        ...[
          'javascript:globalThis.__f5_xss_fixture=1',
          'data:text/html,<script>alert(1)</script>',
          'vbscript:msgbox(1)',
          '//example.invalid/path',
          'https://user:password@example.invalid/path',
          '/%2Fprivate',
          'https://example.invalid/\npath',
          '/\\evil',
        ].map((href) => ({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [text('unsafe fixture', [{ type: 'link', attrs: { href } }])],
            },
          ],
        })),
        {
          type: 'doc',
          content: [{ type: 'script', attrs: { src: 'https://example.invalid/payload.js' } }],
        },
        {
          type: 'doc',
          content: [{ type: 'iframe', attrs: { src: 'https://example.invalid/embed' } }],
        },
      ];
      try {
        for (const content of invalid) {
          await database.query('UPDATE articles SET content=$1::jsonb WHERE slug=$2', [
            JSON.stringify(content),
            articleSlug,
          ]);
          assert.equal((await json(`/articles/${articleSlug}`, 400)).error.code, 'INVALID_CONTENT');
          const body = await html(`/conteudos/${articleSlug}`, 503);
          assert.doesNotMatch(
            body,
            /unsafe fixture|payload\.js|<iframe|<script>globalThis|postgres|Prisma|stack trace/iu,
          );
        }
      } finally {
        await database.query('UPDATE articles SET content=$1::jsonb WHERE slug=$2', [
          JSON.stringify(richDocument()),
          articleSlug,
        ]);
      }
      return { rejectedDocuments: invalid.length };
    },
  );
  await check('unsafe PUBLIC PDF URLs are never rendered as downloads', async () => {
    try {
      for (const value of [
        'javascript:alert(1)',
        '//example.invalid/file.pdf',
        '/media/private/f5.pdf',
        'https://user:password@example.invalid/file.pdf',
      ]) {
        await database.query('UPDATE media SET public_url=$1 WHERE id=$2', [value, pdfMediaId]);
        const body = await html(`/conteudos/${guideSlug}`);
        assert.ok(!body.includes(`href="${value}"`), value);
      }
    } finally {
      await database.query('UPDATE media SET public_url=$1 WHERE id=$2', [pdfUrl, pdfMediaId]);
    }
  });
  await check(
    'unpublishing removes detail and all dependent public lists on next request without rebuild',
    async () => {
      const item = await json(`/articles/${articleSlug}`);
      const dependent = [
        '/',
        `${combinedWeb}&pagina=2`,
        '/areas-de-atuacao/area-ficticia-1',
        '/profissionais/profissional-ficticio-1',
        `/conteudos/f5-${id}-0`,
      ];
      for (const path of dependent)
        assert.ok(
          (await html(path)).includes(`/conteudos/${articleSlug}`),
          `Before withdrawal ${path}`,
        );
      const start = performance.now();
      await database.query("UPDATE articles SET status='DRAFT',published_at=NULL WHERE slug=$1", [
        articleSlug,
      ]);
      try {
        await json(`/articles/${articleSlug}`, 404);
        const { response } = await request(`${webOrigin}/conteudos/${articleSlug}`, 404);
        assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
        assert.equal((await json('/articles?limit=50')).meta.total, 28);
        for (const path of dependent) {
          const { response, body } = await request(`${webOrigin}${path}`);
          assert.ok(!body.includes(`/conteudos/${articleSlug}`), `After withdrawal ${path}`);
          assert.ok(!body.includes(item.title));
          assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
        }
        return {
          cachePolicy: 'no persistent cache; fresh next request',
          elapsedMilliseconds: Math.round(performance.now() - start),
          dependentRoutes: dependent.length,
        };
      } finally {
        await database.query(
          "UPDATE articles SET status='PUBLISHED',published_at='2026-09-02T12:00:00Z' WHERE slug=$1",
          [articleSlug],
        );
      }
    },
  );
  await check(
    'inactive author removes their editorial records and detail from public reads',
    async () => {
      await database.query(
        "UPDATE professionals SET is_active=false WHERE slug='profissional-ficticio-1'",
      );
      try {
        await json(`/articles/${articleSlug}`, 404);
        await html(`/conteudos/${articleSlug}`, 404);
        assert.ok(!(await html('/conteudos')).includes(`/conteudos/${articleSlug}`));
      } finally {
        await database.query(
          "UPDATE professionals SET is_active=true WHERE slug='profissional-ficticio-1'",
        );
      }
    },
  );
  await check('API outage returns safe editorial HTTP503 and no-store', async () => {
    await stop(api);
    api = undefined;
    for (const path of routes) {
      const { response, body } = await request(`${webOrigin}${path}`, 503);
      assert.ok(body.includes('Conteúdo temporariamente indisponível'));
      assert.equal(response.headers.get('retry-after'), '30');
      assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
      assert.doesNotMatch(body, /postgres|Prisma|ECONNREFUSED|DATABASE_URL|stack trace/iu);
    }
  });
  await check('API recovery restores editorial SSR HTTP200 without rebuilding', async () => {
    api = startApi();
    await ready(`${apiOrigin}/health`, api);
    assert.ok(
      (await html(`/conteudos/${articleSlug}`)).includes(`${marker} — leitura editorial fictícia`),
    );
    await html('/conteudos');
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
  report.cleanup.processesStopped = [web, api].every(
    (running) =>
      !running || running.process.exitCode !== null || running.process.signalCode !== null,
  );
  assert.equal(report.cleanup.processesStopped, true, 'Owned API/web processes exited');
  await database?.end().catch(() => undefined);
  database = undefined;
  if (databaseCreated) {
    assert.match(databaseName, /^filaretti_f5_test_[a-f\d]{32}$/u);
    assert.notEqual(baseUrl.pathname, `/${databaseName}`);
    try {
      await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      report.cleanup.databaseRemoved =
        (await operator.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]))
          .rowCount === 0;
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
    assert.equal(fixtureFile, resolve(webRoot, `public/media/public/f5-fixture-${id}.png`));
    try {
      unlinkSync(fixtureFile);
      fixtureCreated = false;
      report.cleanup.rasterRemoved = !existsSync(fixtureFile);
    } catch {
      report.cleanup.rasterRemoved = false;
      report.errors.push({
        check: 'cleanup',
        message: 'Could not remove the owned fixture raster.',
      });
    }
  }
  if (pdfCreated) {
    assert.equal(pdfFile, resolve(webRoot, `public/media/public/f5-fixture-${id}.pdf`));
    try {
      unlinkSync(pdfFile);
      pdfCreated = false;
      report.cleanup.pdfRemoved = !existsSync(pdfFile);
    } catch {
      report.cleanup.pdfRemoved = false;
      report.errors.push({ check: 'cleanup', message: 'Could not remove the owned fixture PDF.' });
    }
  }
  await freePort(apiPort);
  await freePort(webPort);
  report.cleanup.portsReleased = true;
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
      channel: process.env.F5_TEST_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    report.browser = {
      channel: process.env.F5_TEST_BROWSER_CHANNEL ?? 'msedge',
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
  assert.match(databaseName, /^filaretti_f5_test_[a-f\d]{32}$/u);
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
    "INSERT INTO media (id,owner_id,visibility,storage_key,public_url,mime_type,size,alt,source,license,is_mock,updated_at) VALUES ($1,'10000000-0000-4000-8000-000000000001','PUBLIC',$2,$3,'image/png',$4,'Raster fictício de teste F5','fixture local','somente teste',true,NOW())",
    [mediaId, `f5-test/${id}.png`, fixtureUrl, raster.length],
  );
  await database.query(
    "UPDATE professionals SET photo_media_id=$1 WHERE slug='profissional-ficticio-1' AND is_mock=true",
    [mediaId],
  );
  await database.query(
    "UPDATE articles SET cover_media_id=$1 WHERE slug='conteudo-ficticio-01' AND is_mock=true",
    [mediaId],
  );
  await database.query(
    "UPDATE articles SET cover_media_id=$1 WHERE slug='conteudo-ficticio-06' AND is_mock=true",
    [mediaId],
  );
  const pdfBytes = pdf();
  writeFileSync(pdfFile, pdfBytes, { flag: 'wx' });
  pdfCreated = true;
  pdfMediaId = randomUUID();
  await database.query(
    "INSERT INTO media (id,owner_id,visibility,storage_key,public_url,mime_type,size,alt,source,license,is_mock,updated_at) VALUES ($1,'10000000-0000-4000-8000-000000000001','PUBLIC',$2,$3,'application/pdf',$4,'PDF fictício QA F5','fixture local','somente teste',true,NOW())",
    [pdfMediaId, `f5-test/${id}.pdf`, pdfUrl, pdfBytes.length],
  );
  await database.query('UPDATE articles SET pdf_media_id=$1 WHERE slug=$2 AND is_mock=true', [
    pdfMediaId,
    guideSlug,
  ]);
  await prepareFixtures();
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
  report.finishedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      layouts: report.layouts.length,
      failures: report.errors.length,
      cleanup: report.cleanup,
      report: '.local/f5-smoke.json',
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
