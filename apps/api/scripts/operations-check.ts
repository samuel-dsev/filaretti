import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { checkOperationsGate, type OperationsGateContext } from '../src/release/operations-gate';

async function readJson(path: string): Promise<{ bytesSha256: string; value: unknown }> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.size > 1_000_000) throw new Error('INPUT_INVALID');
  const bytes = await readFile(path);
  if (bytes.length > 1_000_000) throw new Error('INPUT_INVALID');
  return {
    bytesSha256: createHash('sha256').update(bytes).digest('hex'),
    value: JSON.parse(bytes.toString('utf8')) as unknown,
  };
}
async function artifactDigest(path: string): Promise<string> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > 5_000_000_000)
    throw new Error('ARTIFACT_INVALID');
  const hash = createHash('sha256');
  let count = 0;
  for await (const chunk of createReadStream(path)) {
    count += (chunk as Buffer).length;
    if (count > 5_000_000_000) throw new Error('ARTIFACT_INVALID');
    hash.update(chunk as Buffer);
  }
  if (count !== metadata.size) throw new Error('ARTIFACT_CHANGED');
  return hash.digest('hex');
}
async function main(): Promise<void> {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      plan: { type: 'string' },
      artifact: { type: 'string' },
      'artifact-manifest': { type: 'string' },
      'candidate-report': { type: 'string' },
      'controlled-report': { type: 'string' },
      'public-report': { type: 'string' },
      offline: { type: 'boolean', default: true },
    },
  });
  // This command has no environment loading, network, database or deployment adapter.
  const root = resolve(__dirname, '../../..');
  const manifest = (await readJson(resolve(root, 'package.json'))).value as { version: string };
  const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const context: OperationsGateContext = {
    current: { version: manifest.version, commit },
    reports: {},
  };
  if (values.artifact && values['artifact-manifest']) {
    context.artifact = {
      bytesSha256: await artifactDigest(resolve(root, values.artifact)),
      manifest: (await readJson(resolve(root, values['artifact-manifest']))).value,
    };
  } else if (values.artifact || values['artifact-manifest'])
    throw new Error('ARTIFACT_PAIR_REQUIRED');
  for (const name of ['candidate', 'controlled', 'public'] as const) {
    const path = values[`${name}-report`];
    if (path) context.reports![name] = await readJson(resolve(root, path));
  }
  const report = checkOperationsGate(
    (await readJson(resolve(root, values.plan ?? 'docs/go-live-plan.template.json'))).value,
    context,
  );
  process.stdout.write(JSON.stringify({ ...report, offline: true }) + '\n');
  if (!report.ready) process.exitCode = 1;
}
main().catch(() => {
  // Never print thrown error text, paths, file contents, env values or credentials.
  process.stderr.write(
    JSON.stringify({
      ready: false,
      status: 'blocked',
      actionAuthorized: false,
      evidenceTrust: 'operator-supplied-records',
      offline: true,
      completedSteps: [],
      nextStep: 'candidateApproved',
      issues: [{ code: 'OPERATIONS_CHECK_FAILED', field: 'command' }],
    }) + '\n',
  );
  process.exitCode = 1;
});
