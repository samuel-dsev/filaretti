import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
  windowsHide: true,
}).trim();
if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('COMMIT_REVISION_REQUIRED');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/ci-artifact.json',
  JSON.stringify(
    {
      revision,
      version,
      createdAt: new Date().toISOString(),
      appEnvironment: 'development',
      mockContent: true,
      deployable: false,
      scope:
        'Local QA build. Rebuild with isolated approved staging configuration before deployment.',
    },
    null,
    2,
  ),
);
console.log(`Review artifact identified: ${revision}, version ${version}; local QA configuration.`);
