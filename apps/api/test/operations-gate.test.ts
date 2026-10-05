import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkOperationsGate,
  operationalSmokeChecks,
  operationSteps,
  type OperationsGateContext,
} from '../src/release/operations-gate';

const now = new Date('2026-10-05T12:00:00.000Z');
const artifact = { commit: 'a'.repeat(40), version: '1.0.0', sha256: 'b'.repeat(64) };
const batchSha256 = 'c'.repeat(64);
const finalOrigin = 'https://www.office.invalid';
function fixture() {
  const evidence: Record<(typeof operationSteps)[number], Record<string, unknown>> = {
    candidateApproved: {
      authorizationReference: 'approval-production-001',
      approvalScopes: ['production', 'real-data', 'hosting-budget'],
      releaseReportSha256: 'd'.repeat(64),
    },
    backupVerified: {
      legacyFrozen: true,
      databaseRestoreVerified: true,
      publicObjectsRestoreVerified: true,
      privateObjectsRestoreVerified: true,
      offsiteCopyVerified: true,
      backupSha256: 'e'.repeat(64),
      recoveryReference: 'restore-001',
    },
    migrationsApplied: {
      schemaCompatible: true,
      migrationsReference: 'migrations-001',
      structuralSeedOnly: true,
    },
    approvedDataLoaded: {
      batchSha256,
      receiptVerified: true,
      activeAdminVerified: true,
      defaultPasswordAbsent: true,
      isolationVerified: true,
      storageVerified: true,
      mailDomainVerified: true,
      secretsProvisioned: true,
    },
    apiWorkerHealthy: { apiReadiness: true, workerReadiness: true, workerContinuous: true },
    controlledWeb: { accessProtected: true, indexingEnabled: false },
    controlledSmoke: { releaseReportSha256: 'f'.repeat(64), checks: [...operationalSmokeChecks] },
    cutoverAuthorized: {
      authorizationReference: 'approval-cutover-001',
      scopes: ['traffic', 'dns', 'indexing'],
    },
    cutoverCompleted: { authorizationReference: 'approval-cutover-001', redirectsApplied: true },
    publicIndexing: { indexingEnabled: true, sitemapVerified: true },
    publicSmoke: { releaseReportSha256: '1'.repeat(64), checks: [...operationalSmokeChecks] },
    monitoringActivated: {
      searchConsoleVerified: true,
      sitemapSubmitted: true,
      analyticsConsentVerified: true,
      enhancedMeasurementDisabled: true,
      monitoringVerified: true,
      alertsVerified: true,
      observationUntil: '2026-10-06T10:00:00.000Z',
    },
    handoff: {
      owner: 'operator-001',
      rollbackOwner: 'rollback-001',
      cmsGuideReference: 'cms-guide-001',
      maintenanceGuideReference: 'maintenance-guide-001',
      recoveryGuideReference: 'recovery-guide-001',
      monitoringGuideReference: 'monitoring-guide-001',
    },
  };
  const previousArtifact = { commit: '2'.repeat(40), version: '0.9.0', sha256: '3'.repeat(64) };
  const plan = {
    schemaVersion: 1,
    targetVersion: '1.0.0',
    artifact: { ...artifact },
    finalOrigin,
    batchSha256,
    owner: 'operator-001',
    rollbackOwner: 'rollback-001',
    cutoverWindow: { startsAt: '2026-10-05T10:08:00.000Z', endsAt: '2026-10-05T10:10:00.000Z' },
    rollbackPlan: {
      reference: 'rollback-plan-001',
      previousArtifact,
      schemaCompatibilityReference: 'schema-compatibility-001',
    },
    steps: operationSteps.map((kind, index) => ({
      kind,
      result: 'passed',
      reference: `operation-${index}-001`,
      actor: 'operator-001',
      at: new Date(Date.parse('2026-10-05T10:01:00.000Z') + index * 60_000).toISOString(),
      commit: artifact.commit,
      artifactSha256: artifact.sha256,
      details: evidence[kind],
    })),
    rollbackEvent: null as null | Record<string, unknown>,
  };
  const release = (phase: 'controlled' | 'public', checkedAt: string) => ({
    ready: true,
    phase,
    checkedAt,
    version: artifact.version,
    commit: artifact.commit,
    batchSha256,
    finalOrigin,
    fixture: false,
    issues: [],
    evidence: { ready: true, issues: [] },
    sources: { ready: true, issues: [] },
    database: { ready: true, issues: [] },
    http: { ready: true, phase, pages: 4, issues: [] },
  });
  const context: OperationsGateContext = {
    current: { commit: artifact.commit, version: artifact.version },
    artifact: {
      bytesSha256: artifact.sha256,
      manifest: {
        schemaVersion: 1,
        ...artifact,
        createdAt: '2026-10-05T10:00:00.000Z',
        appEnvironment: 'production',
        mockContent: false,
        mockIntegrations: false,
        deployable: true,
        finalOrigin,
      },
    },
    reports: {
      candidate: {
        bytesSha256: 'd'.repeat(64),
        value: release('controlled', '2026-10-05T10:00:30.000Z'),
      },
      controlled: {
        bytesSha256: 'f'.repeat(64),
        value: release('controlled', '2026-10-05T10:06:30.000Z'),
      },
      public: { bytesSha256: '1'.repeat(64), value: release('public', '2026-10-05T10:10:30.000Z') },
    },
  };
  return { plan, context };
}
function code(input: unknown, context: OperationsGateContext, expected: string) {
  const result = checkOperationsGate(input, context, now);
  assert.equal(result.ready, false);
  assert.equal(result.actionAuthorized, false);
  assert.equal(
    result.issues.some((issue) => issue.code === expected),
    true,
    JSON.stringify(result),
  );
  return result;
}

test('complete operator record validates only matching production artifact, reports and sequential evidence', () => {
  const { plan, context } = fixture();
  const result = checkOperationsGate(plan, context, now);
  assert.equal(result.ready, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.actionAuthorized, false);
  assert.equal(result.evidenceTrust, 'operator-supplied-records');
  assert.deepEqual(result.completedSteps, operationSteps);
  assert.equal(result.nextStep, null);
});
test('shipped empty template remains blocked, contains no invented approval, and names next manual step', () => {
  const input = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../docs/go-live-plan.template.json'), 'utf8'),
  ) as unknown;
  const result = code(input, fixture().context, 'ARTIFACT_REQUIRED');
  assert.equal(result.status, 'blocked');
  assert.equal(result.nextStep, 'candidateApproved');
  assert.deepEqual(result.completedSteps, []);
});
test('valid evidence prefix stops before missing backup instead of allowing later actions', () => {
  const { plan, context } = fixture();
  plan.steps.splice(1);
  const result = code(plan, context, 'STEP_EVIDENCE_REQUIRED');
  assert.equal(result.status, 'incomplete');
  assert.equal(result.nextStep, 'backupVerified');
  assert.deepEqual(result.completedSteps, ['candidateApproved']);
});
test('F9 release result must exist and be ready, with all prerequisities checked', () => {
  for (const field of ['absent', 'ready', 'database', 'fixture', 'issues'] as const) {
    const { plan, context } = fixture();
    if (field === 'absent') delete context.reports!.candidate;
    else {
      const value = context.reports!.candidate!.value as Record<string, unknown>;
      if (field === 'database') value.database = { ready: false };
      else if (field === 'fixture') value.fixture = true;
      else if (field === 'issues') value.issues = [{ code: 'WORKTREE_DIRTY' }];
      else value.ready = false;
    }
    assert.equal(code(plan, context, 'RELEASE_REPORT_UNVERIFIED').nextStep, 'candidateApproved');
  }
});
test('target 1.0.0 and deployable flags cannot promote checkout 0.10.0, QA metadata or wrong artifact bytes', () => {
  for (const field of [
    'version',
    'commit',
    'bytes',
    'environment',
    'mocks',
    'deployable',
  ] as const) {
    const { plan, context } = fixture();
    let expected = 'PRODUCTION_ARTIFACT_UNVERIFIED';
    const manifest = context.artifact!.manifest as Record<string, unknown>;
    if (field === 'version') {
      context.current.version = '0.10.0';
      expected = 'VERSION_MISMATCH';
    }
    if (field === 'commit') {
      context.current.commit = '4'.repeat(40);
      expected = 'COMMIT_MISMATCH';
    }
    if (field === 'bytes') context.artifact!.bytesSha256 = '4'.repeat(64);
    if (field === 'environment') manifest.appEnvironment = 'development';
    if (field === 'mocks') manifest.mockContent = true;
    if (field === 'deployable') manifest.deployable = false;
    code(plan, context, expected);
  }
});
test('every step and every report binds the approved commit, artifact, batch and HTTPS origin', () => {
  const stepFixture = fixture();
  stepFixture.plan.steps[4]!.artifactSha256 = '4'.repeat(64);
  code(stepFixture.plan, stepFixture.context, 'STEP_IDENTITY_MISMATCH');
  for (const field of ['commit', 'version', 'batchSha256', 'finalOrigin'] as const) {
    const { plan, context } = fixture();
    (context.reports!.public!.value as Record<string, unknown>)[field] = 'different';
    code(plan, context, 'RELEASE_REPORT_UNVERIFIED');
  }
  const { plan, context } = fixture();
  plan.finalOrigin = 'http://www.office.invalid';
  code(plan, context, 'INVALID_OPERATION_PLAN');
});
test('skipped, duplicated or reordered deployment steps never advance past first invalid stage', () => {
  for (const mode of ['skip', 'swap', 'duplicate'] as const) {
    const { plan, context } = fixture();
    if (mode === 'skip') plan.steps.splice(1, 1);
    if (mode === 'swap') [plan.steps[1], plan.steps[2]] = [plan.steps[2]!, plan.steps[1]!];
    if (mode === 'duplicate') plan.steps[2] = { ...plan.steps[1]! };
    const result = code(plan, context, 'STEP_ORDER_INVALID');
    assert.equal(result.nextStep, mode === 'duplicate' ? 'migrationsApplied' : 'backupVerified');
  }
});
test('future, impossible and chronologically reversed timestamps fail closed', () => {
  for (const at of [
    '2026-10-06T10:01:00.000Z',
    '2026-10-05T09:00:00.000Z',
    '2026-02-30T10:01:00.000Z',
  ]) {
    const { plan, context } = fixture();
    plan.steps[3]!.at = at;
    code(plan, context, at.includes('02-30') ? 'INVALID_OPERATION_PLAN' : 'STEP_TIME_INVALID');
  }
});
test('F9 report bytes, time, phase and candidate lineage cannot be substituted', () => {
  for (const mode of [
    'digest',
    'before-deploy',
    'future',
    'public-controlled',
    'controlled-public',
  ] as const) {
    const { plan, context } = fixture();
    if (mode === 'digest') context.reports!.controlled!.bytesSha256 = '4'.repeat(64);
    if (mode === 'before-deploy')
      (context.reports!.controlled!.value as Record<string, unknown>).checkedAt =
        '2026-10-05T10:00:30.000Z';
    if (mode === 'future')
      (context.reports!.public!.value as Record<string, unknown>).checkedAt =
        '2026-10-05T11:00:00.000Z';
    if (mode === 'public-controlled')
      (context.reports!.public!.value as Record<string, unknown>).phase = 'controlled';
    if (mode === 'controlled-public')
      (context.reports!.controlled!.value as Record<string, unknown>).phase = 'public';
    code(plan, context, 'RELEASE_REPORT_UNVERIFIED');
  }
});
test('controlled access keeps indexing off and public indexing is evidenced only after authorized cutover', () => {
  const controlled = fixture();
  controlled.plan.steps[5]!.details.indexingEnabled = true;
  code(controlled.plan, controlled.context, 'CONTROLLED_INDEXING_FORBIDDEN');
  const publicStage = fixture();
  publicStage.plan.steps[9]!.details.indexingEnabled = false;
  code(publicStage.plan, publicStage.context, 'STEP_EVIDENCE_INCOMPLETE');
});
test('cutover requires scoped documentary approval, exact reference and approved window', () => {
  for (const mode of ['scopes', 'reference', 'window', 'flag'] as const) {
    const { plan, context } = fixture();
    let expected = 'CUTOVER_APPROVAL_REQUIRED';
    if (mode === 'scopes') plan.steps[7]!.details.scopes = ['dns'];
    if (mode === 'reference') {
      plan.steps[8]!.details.authorizationReference = 'another-approval';
      expected = 'CUTOVER_AUTHORIZATION_MISMATCH';
    }
    if (mode === 'window') {
      plan.cutoverWindow.endsAt = '2026-10-05T10:08:30.000Z';
      expected = 'CUTOVER_OUTSIDE_WINDOW';
    }
    if (mode === 'flag') {
      plan.steps[7]!.details.authorizationReference = true;
    }
    code(plan, context, expected);
  }
});
test('smoke omitting private uploads, email or consent-related flows cannot declare publication complete', () => {
  for (const kind of ['controlledSmoke', 'publicSmoke'] as const) {
    const { plan, context } = fixture();
    plan.steps.find((step) => step.kind === kind)!.details.checks = operationalSmokeChecks.filter(
      (check) => check !== 'privateUploads',
    );
    code(plan, context, 'SMOKE_INCOMPLETE');
  }
  const { plan, context } = fixture();
  plan.steps[11]!.details.analyticsConsentVerified = false;
  code(plan, context, 'STEP_EVIDENCE_INCOMPLETE');
});
test('unknown fields and non-opaque references are rejected without echoing personal data or secrets', () => {
  const secret = 'https://person:secret@private.invalid/?token=secret';
  const input = fixture();
  input.plan.steps[7]!.reference = secret;
  const result = code(input.plan, input.context, 'INVALID_OPERATION_PLAN');
  assert.equal(JSON.stringify(result).includes(secret), false);
  const extra = fixture();
  code({ ...extra.plan, deployNow: true }, extra.context, 'INVALID_OPERATION_PLAN');
  extra.plan.steps[2]!.details.secret = secret;
  code(extra.plan, extra.context, 'INVALID_OPERATION_PLAN');
  const manifest = fixture();
  (manifest.context.artifact!.manifest as Record<string, unknown>).token = secret;
  code(manifest.plan, manifest.context, 'PRODUCTION_ARTIFACT_UNVERIFIED');
});
test('failed public smoke requires rollback; valid rollback terminates without ever reporting success', () => {
  const { plan, context } = fixture();
  plan.steps.splice(11);
  plan.steps[10]!.result = 'failed';
  plan.steps[10]!.details = { failureReference: 'incident-001' };
  const failed = code(plan, context, 'ROLLBACK_REQUIRED');
  assert.equal(failed.status, 'rollback-required');
  assert.equal(failed.nextStep, 'rollback');
  plan.rollbackEvent = {
    reference: 'rollback-result-001',
    actor: 'rollback-001',
    at: '2026-10-05T10:20:00.000Z',
    failedStep: 'publicSmoke',
    commit: artifact.commit,
    artifactSha256: artifact.sha256,
    previousArtifactSha256: plan.rollbackPlan.previousArtifact.sha256,
    restoredHealthy: true,
  };
  const recovered = code(plan, context, 'OPERATION_FAILED');
  assert.equal(recovered.status, 'rolled-back');
  assert.equal(recovered.nextStep, null);
  plan.rollbackEvent.previousArtifactSha256 = '4'.repeat(64);
  assert.equal(code(plan, context, 'ROLLBACK_REQUIRED').status, 'rollback-required');
});
test('backup failure aborts before deployment; records continuing into mutations require rollback', () => {
  const { plan, context } = fixture();
  plan.steps[1]!.result = 'failed';
  plan.steps[1]!.details = { failureReference: 'backup-incident-001' };
  const result = code(plan, context, 'STEP_ORDER_INVALID');
  assert.equal(result.status, 'rollback-required');
  assert.equal(result.ready, false);
  plan.steps.splice(2);
  assert.equal(code(plan, context, 'OPERATION_FAILED').status, 'blocked');
});
