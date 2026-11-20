import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const workspace = resolve(import.meta.dirname, '../..');
const target = process.argv[2];
if (target !== '/runtime/api') throw new Error('Unexpected API package target');

// npm packaging rules may omit ignored build outputs. Copy the reviewed build
// outputs explicitly, including the generated Prisma client next to its package.
cpSync(join(workspace, 'apps/api/dist'), join(target, 'dist'), { recursive: true });
for (const name of ['config', 'types']) {
  const dependency = realpathSync(join(target, 'node_modules/@filaretti', name));
  if (!dependency.startsWith(`${target}/`)) throw new Error('Dependency escaped runtime package');
  rmSync(join(dependency, 'dist'), { recursive: true, force: true });
  cpSync(join(workspace, 'packages', name, 'dist'), join(dependency, 'dist'), {
    recursive: true,
    dereference: true,
  });
}

const sourceRequire = createRequire(join(workspace, 'apps/api/package.json'));
const targetRequire = createRequire(join(target, 'package.json'));
const generated = (require) =>
  resolve(dirname(require.resolve('@prisma/client/package.json')), '../../.prisma/client');
const sourceClient = generated(sourceRequire);
if (!existsSync(join(sourceClient, 'default.js'))) throw new Error('Prisma client not generated');
const targetClient = generated(targetRequire);
if (!targetClient.startsWith(`${target}/`)) throw new Error('Prisma escaped runtime package');
rmSync(targetClient, { recursive: true, force: true });
mkdirSync(dirname(targetClient), { recursive: true });
cpSync(sourceClient, targetClient, { recursive: true });

// Keep migration/seed/CLI sources in the operations target only.
for (const name of ['src', 'test', 'prisma', 'scripts', 'prisma.config.ts']) {
  rmSync(join(target, name), { recursive: true, force: true });
}
