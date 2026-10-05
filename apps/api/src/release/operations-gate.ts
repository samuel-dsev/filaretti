/** Offline, read-only validation of operator-supplied operational records. Never executes or authorizes an action. */
export const operationSteps = [
  'candidateApproved',
  'backupVerified',
  'migrationsApplied',
  'approvedDataLoaded',
  'apiWorkerHealthy',
  'controlledWeb',
  'controlledSmoke',
  'cutoverAuthorized',
  'cutoverCompleted',
  'publicIndexing',
  'publicSmoke',
  'monitoringActivated',
  'handoff',
] as const;
export type OperationStepKind = (typeof operationSteps)[number];
export const operationalSmokeChecks = [
  'navigation',
  'search',
  'article',
  'contact',
  'newsletterConfirmation',
  'newsletterUnsubscribe',
  'adminAuthentication',
  'publicMedia',
  'privateUploads',
  'emailDelivery',
  'antispam',
  'scheduledPublication',
  'approvedPublication',
  'redirects',
  'rollbackRehearsal',
] as const;

interface Identity {
  commit: string;
  version: string;
  sha256: string;
}
interface OperationStep {
  kind: OperationStepKind;
  result: 'passed' | 'failed';
  reference: string;
  actor: string;
  at: string;
  commit: string;
  artifactSha256: string;
  details: Record<string, unknown>;
}
interface OperationPlan {
  schemaVersion: 1;
  targetVersion: '1.0.0';
  artifact: Identity | null;
  finalOrigin: string | null;
  batchSha256: string | null;
  owner: string | null;
  rollbackOwner: string | null;
  cutoverWindow: { startsAt: string; endsAt: string } | null;
  rollbackPlan: {
    reference: string;
    previousArtifact: Identity;
    schemaCompatibilityReference: string;
  } | null;
  steps: OperationStep[];
  rollbackEvent: {
    reference: string;
    actor: string;
    at: string;
    failedStep: OperationStepKind;
    commit: string;
    artifactSha256: string;
    previousArtifactSha256: string;
    restoredHealthy: true;
  } | null;
}
export interface OperationsGateContext {
  current: { version: string; commit: string };
  artifact?: { bytesSha256: string; manifest: unknown };
  reports?: Partial<
    Record<'candidate' | 'controlled' | 'public', { bytesSha256: string; value: unknown }>
  >;
}
export interface OperationsGateReport {
  ready: boolean;
  status: 'incomplete' | 'blocked' | 'completed' | 'rollback-required' | 'rolled-back';
  actionAuthorized: false;
  evidenceTrust: 'operator-supplied-records';
  completedSteps: OperationStepKind[];
  nextStep: OperationStepKind | 'rollback' | null;
  issues: { code: string; field: string }[];
}
const detailsKeys: Record<OperationStepKind, readonly string[]> = {
  candidateApproved: ['authorizationReference', 'approvalScopes', 'releaseReportSha256'],
  backupVerified: [
    'legacyFrozen',
    'databaseRestoreVerified',
    'publicObjectsRestoreVerified',
    'privateObjectsRestoreVerified',
    'offsiteCopyVerified',
    'backupSha256',
    'recoveryReference',
  ],
  migrationsApplied: ['schemaCompatible', 'migrationsReference', 'structuralSeedOnly'],
  approvedDataLoaded: [
    'batchSha256',
    'receiptVerified',
    'activeAdminVerified',
    'defaultPasswordAbsent',
    'isolationVerified',
    'storageVerified',
    'mailDomainVerified',
    'secretsProvisioned',
  ],
  apiWorkerHealthy: ['apiReadiness', 'workerReadiness', 'workerContinuous'],
  controlledWeb: ['accessProtected', 'indexingEnabled'],
  controlledSmoke: ['releaseReportSha256', 'checks'],
  cutoverAuthorized: ['authorizationReference', 'scopes'],
  cutoverCompleted: ['authorizationReference', 'redirectsApplied'],
  publicIndexing: ['indexingEnabled', 'sitemapVerified'],
  publicSmoke: ['releaseReportSha256', 'checks'],
  monitoringActivated: [
    'searchConsoleVerified',
    'sitemapSubmitted',
    'analyticsConsentVerified',
    'enhancedMeasurementDisabled',
    'monitoringVerified',
    'alertsVerified',
    'observationUntil',
  ],
  handoff: [
    'owner',
    'rollbackOwner',
    'cmsGuideReference',
    'maintenanceGuideReference',
    'recoveryGuideReference',
    'monitoringGuideReference',
  ],
};
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function text(value: unknown, pattern: RegExp, max: number): value is string {
  return typeof value === 'string' && value.length <= max && pattern.test(value);
}
function opaque(value: unknown): value is string {
  // IDs only: no URLs, file paths, email addresses, free text, queries, credentials or tokens in output.
  return text(value, /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,159}$/u, 160);
}
function digest(value: unknown): value is string {
  return text(value, /^[a-f0-9]{64}$/u, 64);
}
function commit(value: unknown): value is string {
  return text(value, /^[a-f0-9]{40}$/u, 40);
}
function version(value: unknown): value is string {
  return text(value, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u, 32);
}
function date(value: unknown): value is string {
  if (!text(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u, 24)) return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === (value.length === 20 ? value.replace('Z', '.000Z') : value)
  );
}
function origin(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
  } catch {
    return false;
  }
}
function identity(value: unknown): value is Identity {
  return (
    object(value) &&
    keys(value, ['commit', 'version', 'sha256']) &&
    commit(value.commit) &&
    version(value.version) &&
    digest(value.sha256)
  );
}
function exactSet(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    new Set(value).size === expected.length &&
    expected.every((item) => value.includes(item))
  );
}
function nullable(value: unknown, validate: (input: unknown) => boolean): boolean {
  return value === null || validate(value);
}
function parsePlan(value: unknown): OperationPlan | null {
  if (
    !object(value) ||
    !keys(value, [
      'schemaVersion',
      'targetVersion',
      'artifact',
      'finalOrigin',
      'batchSha256',
      'owner',
      'rollbackOwner',
      'cutoverWindow',
      'rollbackPlan',
      'steps',
      'rollbackEvent',
    ]) ||
    value.schemaVersion !== 1 ||
    value.targetVersion !== '1.0.0' ||
    !nullable(value.artifact, identity) ||
    !nullable(value.finalOrigin, origin) ||
    !nullable(value.batchSha256, digest) ||
    !nullable(value.owner, opaque) ||
    !nullable(value.rollbackOwner, opaque) ||
    !Array.isArray(value.steps) ||
    value.steps.length > operationSteps.length
  )
    return null;
  if (
    value.cutoverWindow !== null &&
    (!object(value.cutoverWindow) ||
      !keys(value.cutoverWindow, ['startsAt', 'endsAt']) ||
      !date(value.cutoverWindow.startsAt) ||
      !date(value.cutoverWindow.endsAt))
  )
    return null;
  if (
    value.rollbackPlan !== null &&
    (!object(value.rollbackPlan) ||
      !keys(value.rollbackPlan, [
        'reference',
        'previousArtifact',
        'schemaCompatibilityReference',
      ]) ||
      !opaque(value.rollbackPlan.reference) ||
      !identity(value.rollbackPlan.previousArtifact) ||
      !opaque(value.rollbackPlan.schemaCompatibilityReference))
  )
    return null;
  for (const step of value.steps) {
    if (
      !object(step) ||
      !keys(step, [
        'kind',
        'result',
        'reference',
        'actor',
        'at',
        'commit',
        'artifactSha256',
        'details',
      ]) ||
      !operationSteps.includes(step.kind as OperationStepKind) ||
      (step.result !== 'passed' && step.result !== 'failed') ||
      !opaque(step.reference) ||
      !opaque(step.actor) ||
      !date(step.at) ||
      !commit(step.commit) ||
      !digest(step.artifactSha256) ||
      !object(step.details)
    )
      return null;
    const expected =
      step.result === 'failed' ? ['failureReference'] : detailsKeys[step.kind as OperationStepKind];
    if (!keys(step.details, expected)) return null;
    if (step.result === 'failed' && !opaque(step.details.failureReference)) return null;
  }
  if (
    value.rollbackEvent !== null &&
    (!object(value.rollbackEvent) ||
      !keys(value.rollbackEvent, [
        'reference',
        'actor',
        'at',
        'failedStep',
        'commit',
        'artifactSha256',
        'previousArtifactSha256',
        'restoredHealthy',
      ]) ||
      !opaque(value.rollbackEvent.reference) ||
      !opaque(value.rollbackEvent.actor) ||
      !date(value.rollbackEvent.at) ||
      !operationSteps.includes(value.rollbackEvent.failedStep as OperationStepKind) ||
      !commit(value.rollbackEvent.commit) ||
      !digest(value.rollbackEvent.artifactSha256) ||
      !digest(value.rollbackEvent.previousArtifactSha256) ||
      value.rollbackEvent.restoredHealthy !== true)
  )
    return null;
  return value as unknown as OperationPlan;
}

export function checkOperationsGate(
  input: unknown,
  context: OperationsGateContext,
  now = new Date(),
): OperationsGateReport {
  const issues: OperationsGateReport['issues'] = [];
  const completedSteps: OperationStepKind[] = [];
  const add = (code: string, field: string) => issues.push({ code, field });
  const report = (
    status: OperationsGateReport['status'],
    nextStep: OperationsGateReport['nextStep'],
  ): OperationsGateReport => ({
    ready: status === 'completed',
    status,
    actionAuthorized: false,
    evidenceTrust: 'operator-supplied-records',
    completedSteps,
    nextStep,
    issues,
  });
  const parsedPlan = parsePlan(input);
  if (!parsedPlan) {
    add('INVALID_OPERATION_PLAN', 'plan');
    return report('blocked', 'candidateApproved');
  }
  const plan: OperationPlan = parsedPlan;
  if (!Number.isFinite(now.getTime())) {
    add('INVALID_CHECK_TIME', 'clock');
    return report('blocked', 'candidateApproved');
  }
  const artifact = plan.artifact;
  if (!artifact) add('ARTIFACT_REQUIRED', 'artifact');
  if (
    artifact &&
    (artifact.version !== plan.targetVersion || artifact.version !== context.current.version)
  )
    add('VERSION_MISMATCH', 'artifact.version');
  if (artifact && artifact.commit !== context.current.commit)
    add('COMMIT_MISMATCH', 'artifact.commit');
  if (!plan.finalOrigin) add('FINAL_ORIGIN_REQUIRED', 'finalOrigin');
  if (!plan.batchSha256) add('APPROVED_BATCH_REQUIRED', 'batchSha256');
  if (!plan.owner || !plan.rollbackOwner) add('RESPONSIBLE_REQUIRED', 'owner');
  if (
    !plan.cutoverWindow ||
    new Date(plan.cutoverWindow.startsAt) >= new Date(plan.cutoverWindow.endsAt)
  )
    add('CUTOVER_WINDOW_REQUIRED', 'cutoverWindow');
  if (!plan.rollbackPlan) add('ROLLBACK_PLAN_REQUIRED', 'rollbackPlan');
  if (
    plan.rollbackPlan &&
    artifact &&
    plan.rollbackPlan.previousArtifact.sha256 === artifact.sha256
  )
    add('ROLLBACK_ARTIFACT_INVALID', 'rollbackPlan.previousArtifact');

  let artifactCreatedAt: string | null = null;
  const manifest = context.artifact?.manifest;
  if (
    !artifact ||
    !context.artifact ||
    context.artifact.bytesSha256 !== artifact.sha256 ||
    !object(manifest) ||
    !keys(manifest, [
      'schemaVersion',
      'commit',
      'version',
      'sha256',
      'createdAt',
      'appEnvironment',
      'mockContent',
      'mockIntegrations',
      'deployable',
      'finalOrigin',
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.commit !== artifact.commit ||
    manifest.version !== artifact.version ||
    manifest.sha256 !== artifact.sha256 ||
    !date(manifest.createdAt) ||
    new Date(manifest.createdAt) > now ||
    manifest.appEnvironment !== 'production' ||
    manifest.mockContent !== false ||
    manifest.mockIntegrations !== false ||
    manifest.deployable !== true ||
    manifest.finalOrigin !== plan.finalOrigin
  )
    add('PRODUCTION_ARTIFACT_UNVERIFIED', 'artifact');
  else artifactCreatedAt = manifest.createdAt;
  const prerequisitesReady = issues.length === 0;

  function releaseReport(
    name: 'candidate' | 'controlled' | 'public',
    step: OperationStep,
    earliest: string | null,
  ): void {
    const evidence = context.reports?.[name];
    const value = evidence?.value;
    const phase = name === 'public' ? 'public' : 'controlled';
    const verified = (part: unknown): part is Record<string, unknown> =>
      object(part) && part.ready === true && Array.isArray(part.issues) && part.issues.length === 0;
    if (
      !evidence ||
      evidence.bytesSha256 !== step.details.releaseReportSha256 ||
      !digest(step.details.releaseReportSha256) ||
      !object(value) ||
      value.ready !== true ||
      value.version !== artifact?.version ||
      value.commit !== artifact?.commit ||
      value.batchSha256 !== plan.batchSha256 ||
      value.finalOrigin !== plan.finalOrigin ||
      value.fixture !== false ||
      value.phase !== phase ||
      !date(value.checkedAt) ||
      new Date(value.checkedAt) > now ||
      new Date(value.checkedAt) > new Date(step.at) ||
      (earliest !== null && new Date(value.checkedAt) < new Date(earliest)) ||
      !Array.isArray(value.issues) ||
      value.issues.length !== 0 ||
      !verified(value.evidence) ||
      !verified(value.sources) ||
      !verified(value.database) ||
      !verified(value.http) ||
      value.http.phase !== phase ||
      !Number.isInteger(value.http.pages) ||
      Number(value.http.pages) <= 0
    )
      add('RELEASE_REPORT_UNVERIFIED', 'steps.' + step.kind + '.releaseReport');
  }
  let previousAt = artifactCreatedAt;
  let failed: OperationStep | undefined;
  let firstUnverified: OperationStepKind | null = prerequisitesReady ? null : 'candidateApproved';
  for (let index = 0; index < plan.steps.length; index++) {
    const step = plan.steps[index]!;
    const before = issues.length;
    const field = 'steps.' + operationSteps[index]!;
    if (step.kind !== operationSteps[index] || failed) add('STEP_ORDER_INVALID', field);
    if (step.commit !== artifact?.commit || step.artifactSha256 !== artifact?.sha256)
      add('STEP_IDENTITY_MISMATCH', field);
    if (
      new Date(step.at) > now ||
      (previousAt !== null && new Date(step.at) <= new Date(previousAt))
    )
      add('STEP_TIME_INVALID', field);
    previousAt = step.at;
    if (step.result === 'failed') {
      failed ??= step;
      add('OPERATION_FAILED', field);
    } else {
      const detail = step.details;
      const requireTrue = (fields: readonly string[]) => {
        if (fields.some((key) => detail[key] !== true)) add('STEP_EVIDENCE_INCOMPLETE', field);
      };
      switch (step.kind) {
        case 'candidateApproved':
          if (
            !opaque(detail.authorizationReference) ||
            !exactSet(detail.approvalScopes, ['production', 'real-data', 'hosting-budget'])
          )
            add('PRODUCTION_APPROVAL_REQUIRED', field);
          releaseReport('candidate', step, artifactCreatedAt);
          break;
        case 'backupVerified':
          requireTrue([
            'legacyFrozen',
            'databaseRestoreVerified',
            'publicObjectsRestoreVerified',
            'privateObjectsRestoreVerified',
            'offsiteCopyVerified',
          ]);
          if (!digest(detail.backupSha256) || !opaque(detail.recoveryReference))
            add('BACKUP_EVIDENCE_REQUIRED', field);
          break;
        case 'migrationsApplied':
          requireTrue(['schemaCompatible', 'structuralSeedOnly']);
          if (!opaque(detail.migrationsReference)) add('MIGRATION_EVIDENCE_REQUIRED', field);
          break;
        case 'approvedDataLoaded':
          requireTrue([
            'receiptVerified',
            'activeAdminVerified',
            'defaultPasswordAbsent',
            'isolationVerified',
            'storageVerified',
            'mailDomainVerified',
            'secretsProvisioned',
          ]);
          if (detail.batchSha256 !== plan.batchSha256) add('BATCH_DIGEST_MISMATCH', field);
          break;
        case 'apiWorkerHealthy':
          requireTrue(['apiReadiness', 'workerReadiness', 'workerContinuous']);
          break;
        case 'controlledWeb':
          requireTrue(['accessProtected']);
          if (detail.indexingEnabled !== false) add('CONTROLLED_INDEXING_FORBIDDEN', field);
          break;
        case 'controlledSmoke':
        case 'publicSmoke':
          if (!exactSet(detail.checks, operationalSmokeChecks)) add('SMOKE_INCOMPLETE', field);
          releaseReport(
            step.kind === 'controlledSmoke' ? 'controlled' : 'public',
            step,
            plan.steps[step.kind === 'controlledSmoke' ? 5 : 9]?.at ?? null,
          );
          break;
        case 'cutoverAuthorized':
          if (
            !opaque(detail.authorizationReference) ||
            !exactSet(detail.scopes, ['traffic', 'dns', 'indexing'])
          )
            add('CUTOVER_APPROVAL_REQUIRED', field);
          break;
        case 'cutoverCompleted':
          requireTrue(['redirectsApplied']);
          if (
            !opaque(detail.authorizationReference) ||
            detail.authorizationReference !== plan.steps[7]?.details.authorizationReference
          )
            add('CUTOVER_AUTHORIZATION_MISMATCH', field);
          if (
            !plan.cutoverWindow ||
            new Date(step.at) < new Date(plan.cutoverWindow.startsAt) ||
            new Date(step.at) > new Date(plan.cutoverWindow.endsAt)
          )
            add('CUTOVER_OUTSIDE_WINDOW', field);
          break;
        case 'publicIndexing':
          requireTrue(['indexingEnabled', 'sitemapVerified']);
          break;
        case 'monitoringActivated':
          requireTrue([
            'searchConsoleVerified',
            'sitemapSubmitted',
            'analyticsConsentVerified',
            'enhancedMeasurementDisabled',
            'monitoringVerified',
            'alertsVerified',
          ]);
          if (
            !date(detail.observationUntil) ||
            new Date(detail.observationUntil) <= new Date(step.at)
          )
            add('OBSERVATION_WINDOW_REQUIRED', field);
          break;
        case 'handoff':
          if (
            detail.owner !== plan.owner ||
            detail.rollbackOwner !== plan.rollbackOwner ||
            ![
              'cmsGuideReference',
              'maintenanceGuideReference',
              'recoveryGuideReference',
              'monitoringGuideReference',
            ].every((key) => opaque(detail[key]))
          )
            add('HANDOFF_EVIDENCE_REQUIRED', field);
          if (
            typeof plan.steps[11]?.details.observationUntil !== 'string' ||
            new Date(step.at) >= new Date(plan.steps[11].details.observationUntil)
          )
            add('OBSERVATION_WINDOW_EXPIRED', field);
          break;
      }
    }
    if (issues.length !== before && firstUnverified === null)
      firstUnverified = operationSteps[index]!;
    if (prerequisitesReady && firstUnverified === null) completedSteps.push(step.kind);
  }
  if (failed) {
    const rollbackRequired = plan.steps.some((step) => operationSteps.indexOf(step.kind) >= 2);
    if (rollbackRequired) {
      const event = plan.rollbackEvent;
      if (
        !event ||
        issues.some((issue) => issue.code !== 'OPERATION_FAILED') ||
        event.failedStep !== failed.kind ||
        event.actor !== plan.rollbackOwner ||
        event.commit !== artifact?.commit ||
        event.artifactSha256 !== artifact?.sha256 ||
        event.previousArtifactSha256 !== plan.rollbackPlan?.previousArtifact.sha256 ||
        new Date(event.at) <= new Date(failed.at) ||
        new Date(event.at) > now
      ) {
        add('ROLLBACK_REQUIRED', 'rollbackEvent');
        return report('rollback-required', 'rollback');
      }
      return report('rolled-back', null);
    }
    if (plan.rollbackEvent) add('UNEXPECTED_ROLLBACK', 'rollbackEvent');
    return report('blocked', firstUnverified);
  }
  if (plan.rollbackEvent) {
    add('UNEXPECTED_ROLLBACK', 'rollbackEvent');
    return report('blocked', firstUnverified);
  }
  if (issues.length) return report('blocked', firstUnverified);
  if (plan.steps.length < operationSteps.length) {
    const next = operationSteps[plan.steps.length]!;
    add('STEP_EVIDENCE_REQUIRED', 'steps.' + next);
    return report('incomplete', next);
  }
  return report('completed', null);
}
