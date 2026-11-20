import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const workspace = resolve(import.meta.dirname, '../..');
const file = process.argv[2];
if (file !== '/run/secrets/web-build.env') throw new Error('Expected private BuildKit mount');
process.loadEnvFile(file);

const configPath = resolve(workspace, 'apps/web/next.config.ts');
const config = readFileSync(configPath, 'utf8');
const marker = 'const nextConfig: NextConfig = {';
if (!config.includes(marker) || /\boutput\s*:/u.test(config)) {
  throw new Error('Review standalone config preparation for the current Next config');
}
// This changes only the source inside the disposable Docker build stage.
writeFileSync(
  configPath,
  config.replace(
    marker,
    `${marker}\n  output: 'standalone',\n  experimental: { cpus: 2 },\n  outputFileTracingRoot: ${JSON.stringify(workspace)},`,
  ),
);

const result = spawnSync(
  'pnpm',
  ['--filter', '@filaretti/web', 'exec', 'next', 'build', '--webpack'],
  {
    cwd: workspace,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1536',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
  },
);
if (result.error) throw new Error('Unable to start the web build');
if (result.status !== 0) process.exit(result.status ?? 1);
