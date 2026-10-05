import { containsReleaseMarker } from './markers';
import { redirectPath } from '../cms/redirects';
import type { MigrationBatch } from './migration-contract';

export interface ReleaseChecklist {
  schemaVersion: 1;
  version: string;
  commit: string | null;
  batchSha256: string | null;
  finalOrigin: string | null;
  approvals: Record<
    'content' | 'migration' | 'privacyRetention' | 'professionalPresentation',
    unknown
  >;
  evidence: Record<
    | 'f8'
    | 'ci'
    | 'providers'
    | 'backupRestore'
    | 'accessibility'
    | 'seo'
    | 'mediaIntegrity'
    | 'forms',
    unknown
  >;
  operations: {
    owner: string | null;
    cutoverWindow: string | null;
    rollbackOwner: string | null;
    hosting: string | null;
    budgetApproved: boolean;
    dnsApproved: boolean;
  };
  candidatePaths: string[];
}
export interface ReleaseEvidenceIssue {
  code: string;
  field: string;
}
const approvals = ['content', 'migration', 'privacyRetention', 'professionalPresentation'] as const;
const evidence = [
  'f8',
  'ci',
  'providers',
  'backupRestore',
  'accessibility',
  'seo',
  'mediaIntegrity',
  'forms',
] as const;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
function approval(value: unknown, now: Date): boolean {
  if (
    !object(value) ||
    !exactKeys(value, ['reference', 'reviewer', 'approvedAt']) ||
    typeof value.reference !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,159}$/u.test(value.reference) ||
    typeof value.reviewer !== 'string' ||
    !value.reviewer.trim() ||
    value.reviewer.length > 160 ||
    typeof value.approvedAt !== 'string'
  )
    return false;
  const date = new Date(value.approvedAt);
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value.approvedAt) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString() ===
      (value.approvedAt.length === 20
        ? value.approvedAt.replace('Z', '.000Z')
        : value.approvedAt) &&
    date <= now &&
    !containsReleaseMarker(value)
  );
}
export function checkReleaseEvidence(
  input: unknown,
  batch: MigrationBatch | null,
  current: { version: string; commit: string },
  now = new Date(),
): { ready: boolean; issues: ReleaseEvidenceIssue[]; checklist: ReleaseChecklist | null } {
  const issues: ReleaseEvidenceIssue[] = [];
  const add = (code: string, field: string) => issues.push({ code, field });
  if (
    !object(input) ||
    !exactKeys(input, [
      'schemaVersion',
      'version',
      'commit',
      'batchSha256',
      'finalOrigin',
      'approvals',
      'evidence',
      'operations',
      'candidatePaths',
    ]) ||
    input.schemaVersion !== 1 ||
    !object(input.approvals) ||
    !exactKeys(input.approvals, approvals) ||
    !object(input.evidence) ||
    !exactKeys(input.evidence, evidence) ||
    !object(input.operations) ||
    !exactKeys(input.operations, [
      'owner',
      'cutoverWindow',
      'rollbackOwner',
      'hosting',
      'budgetApproved',
      'dnsApproved',
    ]) ||
    !Array.isArray(input.candidatePaths) ||
    input.candidatePaths.length > 2000 ||
    !input.candidatePaths.every(redirectPath) ||
    new Set(input.candidatePaths).size !== input.candidatePaths.length
  )
    return {
      ready: false,
      issues: [{ code: 'INVALID_CHECKLIST', field: 'checklist' }],
      checklist: null,
    };
  if (input.version !== current.version) add('VERSION_MISMATCH', 'version');
  if (
    typeof input.commit !== 'string' ||
    !/^[a-f0-9]{40}$/u.test(input.commit) ||
    input.commit !== current.commit
  )
    add('COMMIT_UNVERIFIED', 'commit');
  if (!batch || batch.fixture) add('APPROVED_BATCH_REQUIRED', 'batch');
  if (!batch || input.batchSha256 !== batch.sha256) add('BATCH_DIGEST_MISMATCH', 'batchSha256');
  try {
    const origin = new URL(String(input.finalOrigin));
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== input.finalOrigin ||
      origin.username ||
      origin.password ||
      containsReleaseMarker(input.finalOrigin)
    )
      add('FINAL_ORIGIN_REQUIRED', 'finalOrigin');
  } catch {
    add('FINAL_ORIGIN_REQUIRED', 'finalOrigin');
  }
  for (const key of approvals)
    if (!approval(input.approvals[key], now)) add('APPROVAL_MISSING', 'approvals.' + key);
  for (const key of evidence)
    if (!approval(input.evidence[key], now)) add('EVIDENCE_MISSING', 'evidence.' + key);
  for (const key of ['owner', 'cutoverWindow', 'rollbackOwner', 'hosting'] as const)
    if (
      typeof input.operations[key] !== 'string' ||
      !String(input.operations[key]).trim() ||
      String(input.operations[key]).length > 200 ||
      containsReleaseMarker(input.operations[key])
    )
      add('OPERATIONAL_PLAN_MISSING', 'operations.' + key);
  if (input.operations.budgetApproved !== true)
    add('BUDGET_APPROVAL_MISSING', 'operations.budgetApproved');
  if (input.operations.dnsApproved !== true) add('DNS_APPROVAL_MISSING', 'operations.dnsApproved');
  if (input.candidatePaths.length === 0) add('CANDIDATE_PATHS_MISSING', 'candidatePaths');
  return { ready: issues.length === 0, issues, checklist: input as unknown as ReleaseChecklist };
}
