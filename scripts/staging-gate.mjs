import { execFileSync } from 'node:child_process';

const revision = process.env.REVIEWED_REVISION;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
  windowsHide: true,
}).trim();
let validUrl = false;
try {
  const url = new URL(process.env.STAGING_URL);
  validUrl =
    url.protocol === 'https:' &&
    url.hostname.startsWith('staging.') &&
    !url.username &&
    !url.password;
} catch {
  /* Fail closed without publishing input. */
}
const approved = [
  'STAGING_AUTHORIZED',
  'STAGING_INGRESS_VERIFIED',
  'STAGING_BACKUP_VERIFIED',
].every((name) => process.env[name] === 'true');
if (!/^[a-f0-9]{40}$/u.test(revision ?? '') || revision !== actual || !validUrl || !approved) {
  console.error(
    'Protected staging gate is incomplete. Verify revision, authorization, HTTPS ingress and recovery evidence.',
  );
  process.exitCode = 1;
} else
  console.log(
    'Manual readiness gate passed. Deployment adapters and external provider checks remain required.',
  );
