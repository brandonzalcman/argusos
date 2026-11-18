import type {
  IsoDateTime,
  LiveTableSnapshot,
  MigrationPlanId,
  TableSnapshotPair,
} from "./model.js";
import type {
  ConversionPreflightRequest,
  ConversionPreflightResult,
  MigrationDiff,
  MigrationExecutionRequest,
  MigrationExecutionResult,
  MigrationPlan,
  MigrationPlanningInput,
  MigrationPreview,
  MigrationValidationResult,
} from "./operations.js";
import type { ConversionPreflightPort, MigrationExecutionPorts } from "./ports.js";

/** Trusted plan identity and expiry supplied by infrastructure, never by SQL text. */
export interface PlanningMetadata {
  readonly planId: MigrationPlanId;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

/**
 * TODO(implementation): compute a deterministic catalog diff without executing SQL.
 * Input: Tenant-bound live/draft snapshots; null live denotes initial creation.
 * Output: Stable ordered operations and destructive-operation identities.
 * Errors: Throws on tenant/table/short-id mismatch or a draft based on another live version.
 * Depends on: `@argus/schema` canonical definitions and immutable field/storage ids.
 */
export function diffTableSnapshots(_input: MigrationPlanningInput): MigrationDiff {
  throw new Error("TODO(implementation): diffTableSnapshots");
}

/**
 * TODO(implementation): run a read-only conversion check for one type-change operation.
 * Input: Tenant-bound diff, operation id, bounded sample request, and database port.
 * Output: Conversion counts and redacted row-id samples; no rows or catalog are changed.
 * Errors: Throws on stale plans, unsupported conversions, or tenant/incident violations.
 * Depends on: Field-type conversion registry and `ConversionPreflightPort` RLS enforcement.
 */
export function runConversionPreflight(
  _request: ConversionPreflightRequest,
  _port: ConversionPreflightPort,
): Promise<ConversionPreflightResult> {
  throw new Error("TODO(implementation): runConversionPreflight");
}

/**
 * TODO(implementation): produce an immutable, digest-bound transactional migration plan.
 * Input: Snapshot pair, all required conversion preflights, and trusted plan metadata.
 * Output: Ordered guard/DDL/backfill/verify/catalog/audit steps and impact metadata.
 * Errors: Throws on missing/failed preflight, unsafe conversion, or invalid retention.
 * Depends on: Diff, field-type capabilities, safe SQL builders, RLS and audit hooks.
 */
export function planMigration(
  _input: MigrationPlanningInput,
  _preflight: readonly ConversionPreflightResult[],
  _metadata: PlanningMetadata,
): MigrationPlan {
  throw new Error("TODO(implementation): planMigration");
}

/**
 * TODO(implementation): render a plain-language preview without executing migration steps.
 * Input: A complete migration plan with preflight and impact information.
 * Output: Human-readable statements, destructive warnings, and publish eligibility.
 * Errors: Throws on malformed or internally inconsistent plans; performs no database I/O.
 * Depends on: Plan validation and redaction so sensitive row values never enter previews.
 */
export function previewMigration(_plan: MigrationPlan): MigrationPreview {
  throw new Error("TODO(implementation): previewMigration");
}

/**
 * TODO(implementation): revalidate plan digest, optimistic versions, safety, and scope.
 * Input: Execution request and the currently locked tenant-owned live snapshot.
 * Output: All validation issues; `valid` is true only when no issue blocks execution.
 * Errors: Throws only for malformed inputs; expected validation failures are returned.
 * Depends on: Locked catalog snapshot, safe SQL inspection, and RLS/retention invariants.
 */
export function validateMigrationPlan(
  _request: MigrationExecutionRequest,
  _currentLive: LiveTableSnapshot | null,
): MigrationValidationResult {
  throw new Error("TODO(implementation): validateMigrationPlan");
}

/**
 * TODO(implementation): orchestrate all migration steps in one atomic PostgreSQL transaction.
 * Input: Digest/version-bound execution request and transaction/catalog/audit/RLS ports.
 * Output: Publication metadata only after every step and audit event commits successfully.
 * Errors: Rolls back everything on validation, SQL, conflict, RLS, audit, or commit failure.
 * Depends on: PostgreSQL transactional DDL; no step may bypass parameters, RLS, or retention.
 */
export function executeMigrationTransaction(
  _request: MigrationExecutionRequest,
  _ports: MigrationExecutionPorts,
): Promise<MigrationExecutionResult> {
  throw new Error("TODO(implementation): executeMigrationTransaction");
}

/** Convenience input for callers that only need a pure snapshot diff. */
export type SnapshotDiffInput = TableSnapshotPair & Pick<MigrationPlanningInput, "context">;
