import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['.env', 'apps/api/.env', 'apps/web/.env.local'];
if (targets.some((target) => existsSync(resolve(root, target)))) {
  console.error(
    'Local environment already exists. No file was changed. Follow README to edit it locally.',
  );
  process.exit(1);
}
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret();
const replacements = {
  'replace-with-local-random-password': dbPassword,
  'replace-with-random-jwt-secret': secret(),
  'replace-with-random-refresh-secret': secret(),
  'replace-with-random-preview-secret': secret(),
  'replace-with-random-revalidation-secret': secret(),
};
const examples = ['.env.example', 'apps/api/.env.example', 'apps/web/.env.example'];
const contents = examples.map((example) => {
  let content = readFileSync(resolve(root, example), 'utf8');
  for (const [placeholder, value] of Object.entries(replacements))
    content = content.replaceAll(placeholder, value);
  return content;
});
targets.forEach((target, index) => {
  const path = resolve(root, target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents[index], { flag: 'wx', mode: 0o600 });
});
console.log(
  'Created ignored local environments with random development secrets. No values were displayed.',
);
