import type {
  AuditEventId,
  DraftTableSnapshot,
  FieldSnapshot,
  FieldTypeReference,
  IndexSnapshot,
  IsoDateTime,
  LiveTableSnapshot,
  MigrationPlanId,
  OperationContext,
  PublicationId,
  RelationSnapshot,
  RowLevelSecuritySnapshot,
  TableId,
  TransactionId,
} from "./model.js";
import type { ParameterizedSql } from "./sql.js";

interface MigrationOperationBase {
  readonly operationId: string;
  readonly tableId: TableId;
  readonly summary: string;
}

export interface CreateTableOperation extends MigrationOperationBase {
  readonly kind: "create-table";
  readonly after: LiveTableSnapshot["definition"];
}

export interface RemoveTableOperation extends MigrationOperationBase {
  readonly kind: "remove-table";
  readonly before: LiveTableSnapshot["definition"];
  readonly tombstoneName: string;
  readonly retainUntil: IsoDateTime;
}

export interface AddFieldOperation extends MigrationOperationBase {
  readonly kind: "add-field";
  readonly after: FieldSnapshot;
}

export interface RemoveFieldOperation extends MigrationOperationBase {
  readonly kind: "remove-field";
  readonly before: FieldSnapshot;
  readonly tombstoneColumn: string;
  readonly retainUntil: IsoDateTime;
}

export interface RenameFieldOperation extends MigrationOperationBase {
  readonly kind: "rename-field";
  readonly fieldId: FieldSnapshot["fieldId"];
  readonly beforeDisplayName: string;
  readonly afterDisplayName: string;
}

/** Conversion metadata is executable only after preflight and planner validation. */
export interface FieldConversion {
  readonly strategy: "registered-cast" | "expression" | "manual";
  readonly expressionId: string | null;
  readonly onNull: "preserve" | "use-default" | "reject";
  readonly onFailure: "reject-publish";
}

export interface ChangeFieldTypeOperation extends MigrationOperationBase {
  readonly kind: "change-field-type";
  readonly before: FieldSnapshot;
  readonly afterType: FieldTypeReference;
  readonly conversion: FieldConversion;
}

export interface SetFieldDefaultOperation extends MigrationOperationBase {
  readonly kind: "set-field-default";
  readonly before: FieldSnapshot;
  readonly afterDefault: FieldSnapshot["defaultExpression"];
}

export interface AddIndexOperation extends MigrationOperationBase {
  readonly kind: "add-index";
  readonly after: IndexSnapshot;
}

export interface RemoveIndexOperation extends MigrationOperationBase {
  readonly kind: "remove-index";
  readonly before: IndexSnapshot;
}

export interface AddRelationOperation extends MigrationOperationBase {
  readonly kind: "add-relation";
  readonly after: RelationSnapshot;
}

export interface RemoveRelationOperation extends MigrationOperationBase {
  readonly kind: "remove-relation";
  readonly before: RelationSnapshot;
}

export interface ChangeRowSecurityOperation extends MigrationOperationBase {
  readonly kind: "change-row-security";
  readonly before: RowLevelSecuritySnapshot;
  readonly after: RowLevelSecuritySnapshot;
}

/** All catalog changes understood by the planner; raw DDL is not an operation. */
export type MigrationOperation =
  | CreateTableOperation
  | RemoveTableOperation
  | AddFieldOperation
  | RemoveFieldOperation
  | RenameFieldOperation
  | ChangeFieldTypeOperation
  | SetFieldDefaultOperation
  | AddIndexOperation
  | RemoveIndexOperation
  | AddRelationOperation
  | RemoveRelationOperation
  | ChangeRowSecurityOperation;

/** A deterministic, tenant-scoped diff with optimistic version identities. */
export interface MigrationDiff {
  readonly tenantId: OperationContext["tenantId"];
  readonly tableId: TableId;
  readonly baseLiveVersion: number | null;
  readonly draftRevision: number;
  readonly operations: readonly MigrationOperation[];
  readonly destructiveOperationIds: readonly string[];
}

/** Read-only conversion check request; row samples contain ids, never raw values. */
export interface ConversionPreflightRequest {
  readonly context: OperationContext;
  readonly diff: MigrationDiff;
  readonly operationId: string;
  readonly sampleLimit: number;
}

export interface ConversionFailureSample {
  readonly recordId: string;
  readonly incidentId: string | null;
  readonly reasonCode: "invalid-format" | "overflow" | "null" | "unsupported-value";
}

export interface ConversionPreflightResult {
  readonly tenantId: OperationContext["tenantId"];
  readonly tableId: TableId;
  readonly baseLiveVersion: number | null;
  readonly draftRevision: number;
  readonly operationId: string;
  readonly scannedRows: number;
  readonly convertibleRows: number;
  readonly failedRows: number;
  readonly truncated: boolean;
  readonly samples: readonly ConversionFailureSample[];
  readonly checkedAt: IsoDateTime;
}

/** Ordered transactional work; no step may open a second transaction boundary. */
export interface MigrationStep {
  readonly stepId: string;
  readonly ordinal: number;
  readonly operationIds: readonly string[];
  readonly phase: "guard" | "ddl" | "backfill" | "verify" | "catalog" | "audit";
  readonly description: string;
  readonly statement: ParameterizedSql | null;
  readonly transaction: "enclosing";
  readonly requiresExclusiveLock: boolean;
}

export interface MigrationImpact {
  readonly destructive: boolean;
  readonly affectsActiveIncidents: boolean;
  readonly estimatedRows: number | null;
  readonly estimatedLockMilliseconds: number | null;
  readonly requiresMaintenanceWindow: boolean;
}

/** Immutable, digest-bound migration artifact approved before execution. */
export interface MigrationPlan {
  readonly planId: MigrationPlanId;
  readonly context: OperationContext;
  readonly baseLiveVersion: number | null;
  readonly draftRevision: number;
  readonly diff: MigrationDiff;
  readonly steps: readonly MigrationStep[];
  readonly preflight: readonly ConversionPreflightResult[];
  readonly impact: MigrationImpact;
  readonly planDigest: string;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export interface MigrationPreviewWarning {
  readonly code:
    | "destructive-retained"
    | "conversion-failures"
    | "active-incident-lock"
    | "long-running-backfill"
    | "rollback-unavailable";
  readonly message: string;
  readonly operationIds: readonly string[];
}

/** User-facing explanation; preview never executes DDL or mutates catalog state. */
export interface MigrationPreview {
  readonly plan: MigrationPlan;
  readonly statements: readonly string[];
  readonly warnings: readonly MigrationPreviewWarning[];
  readonly canPublish: boolean;
}

export interface MigrationValidationIssue {
  readonly code:
    | "stale-base-version"
    | "stale-draft"
    | "plan-expired"
    | "digest-mismatch"
    | "missing-preflight"
    | "unsafe-step"
    | "missing-retention"
    | "tenant-mismatch"
    | "incident-scope-mismatch"
    | "rls-not-preserved";
  readonly message: string;
  readonly operationIds: readonly string[];
}

export interface MigrationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly MigrationValidationIssue[];
}

/** Approval is bound to the exact plan digest and every destructive operation. */
export interface DestructiveChangeAcknowledgement {
  readonly planDigest: string;
  readonly operationIds: readonly string[];
  readonly acknowledgedBy: OperationContext["actor"];
  readonly acknowledgedAt: IsoDateTime;
  readonly retentionUnderstood: true;
}

export interface MigrationExecutionRequest {
  readonly context: OperationContext;
  readonly plan: MigrationPlan;
  readonly expectedLiveVersion: number | null;
  readonly acknowledgement: DestructiveChangeAcknowledgement | null;
}

/** Returned only after DDL, catalog, RLS verification, and audit commit atomically. */
export interface MigrationExecutionResult {
  readonly planId: MigrationPlanId;
  readonly transactionId: TransactionId;
  readonly publicationId: PublicationId;
  readonly publishedVersion: number;
  readonly auditEventId: AuditEventId;
  readonly committedAt: IsoDateTime;
}

/** Planner input remains explicit about both snapshots and request identity. */
export interface MigrationPlanningInput {
  readonly context: OperationContext;
  readonly live: LiveTableSnapshot | null;
  readonly draft: DraftTableSnapshot;
}
