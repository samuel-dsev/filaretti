import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

// Explicit local developer action; messages are never served by the public app.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = join(root, 'apps/api');
const requireApi = createRequire(join(apiRoot, 'package.json'));
requireApi('dotenv').config({ path: join(apiRoot, '.env'), quiet: true });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const escape = (text) =>
  String(text).replace(
    /[&<>"']/gu,
    (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value],
  );
try {
  const environment = requireApi('@filaretti/config').validateApiEnvironment(process.env);
  if (
    environment.APP_ENV !== 'development' ||
    !environment.MOCK_INTEGRATIONS ||
    environment.API_HOST !== '127.0.0.1' ||
    environment.RESEND_ENABLED ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(environment.WEB_PUBLIC_URL).hostname)
  )
    throw new Error('Local mock required');
  const mailbox = resolve(apiRoot, environment.MAIL_LOCAL_PATH);
  await mkdir(mailbox, { recursive: true });
  const selected = process.argv[2];
  if (process.argv.length > 3 || (selected && !uuid.test(selected)))
    throw new Error('Supply one mailbox UUID');
  const { decryptMail, renderTransactionalMail } = requireApi(
    './dist/relationship/email-outbox.js',
  );
  async function readMessage(id) {
    const path = join(mailbox, `${id}.json`);
    const metadata = await lstat(path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size > 65536 ||
      metadata.mtimeMs < Date.now() - 7 * 86400000
    )
      throw new Error('Unavailable local message');
    const capture = JSON.parse(await readFile(path, 'utf8'));
    if (capture.id !== id || typeof capture.idempotencyKey !== 'string')
      throw new Error('Invalid capture');
    return {
      message: decryptMail(environment, capture.payload, capture.idempotencyKey),
      date: metadata.mtime.toISOString(),
    };
  }
  if (!selected) {
    const entries = await readdir(mailbox, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const id = entry.name.replace(/\.json$/u, '');
      if (!entry.isFile() || !entry.name.endsWith('.json') || !uuid.test(id)) continue;
      try {
        const { message, date } = await readMessage(id);
        console.log(`${id}\t${message.kind}\t${date}`);
        count++;
      } catch {
        /* Expired or invalid captures are excluded. */
      }
    }
    if (!count) console.log('Nenhuma mensagem local disponível.');
    console.log('Para abrir uma captura: pnpm mail:local <UUID>.');
  } else {
    const { message } = await readMessage(selected);
    const rendered = renderTransactionalMail(environment, message);
    const links = rendered.text.match(/https?:\/\/\S+/gu) ?? [];
    const actions = links
      .filter((link) => new URL(link).origin === new URL(environment.WEB_PUBLIC_URL).origin)
      .map((link) => `<p><a href="${escape(link)}" rel="noreferrer">Abrir ação local</a></p>`)
      .join('');
    const output = join(mailbox, `${selected}.html`);
    try {
      const existing = await lstat(output);
      if (!existing.isFile() || existing.isSymbolicLink()) throw new Error('Invalid output');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await writeFile(
      output,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Entrega simulada local</title><style>body{max-width:48rem;margin:3rem auto;padding:1rem;font:1rem/1.6 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>${escape(rendered.subject)}</h1><p>Entrega simulada; somente dados fictícios.</p><p>${escape(message.recipient)}</p><pre>${escape(rendered.text)}</pre>${actions}</html>`,
      { mode: 0o600 },
    );
    console.log(`Captura local criada: ${output}`);
  }
} catch {
  console.error(
    'Caixa local indisponível. Confira o build da API, modo simulado e UUID da captura.',
  );
  process.exitCode = 1;
}
