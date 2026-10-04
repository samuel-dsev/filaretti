import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiFile = resolve(root, 'apps/api/.env');
const webFile = resolve(root, 'apps/web/.env.local');
if (!existsSync(apiFile) || !existsSync(webFile)) {
  throw new Error('Existing local environments are required. Run setup:local for a new checkout.');
}
const api = readFileSync(apiFile, 'utf8');
const web = readFileSync(webFile, 'utf8');
if (![api, web].every((content) => /^APP_ENV=development\s*$/mu.test(content))) {
  throw new Error('CMS setup is allowed only in local development.');
}
const secret = /^REVALIDATION_SECRET=([a-zA-Z0-9_-]{32,})\s*$/mu.exec(api)?.[1];
if (!secret)
  throw new Error('A valid API revalidation secret is required. No values were displayed.');
const current = /^REVALIDATION_SECRET=(.*)$/mu.exec(web);
if (current) {
  if (current[1].trim() !== secret) {
    throw new Error('Existing web secret differs from API. No file was overwritten.');
  }
  console.log('Local CMS revalidation configuration is already aligned.');
} else {
  writeFileSync(webFile, `${web.trimEnd()}\nREVALIDATION_SECRET=${secret}\n`, { mode: 0o600 });
  console.log('Aligned ignored local CMS configuration. No secret values were displayed.');
}
