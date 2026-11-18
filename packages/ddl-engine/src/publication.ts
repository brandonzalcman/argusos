import type { AuditEventId, OperationContext, PublicationId, TableId } from "./model.js";
import type {
  DestructiveChangeAcknowledgement,
  MigrationExecutionResult,
  MigrationPlan,
} from "./operations.js";
import type {
  MigrationAuditPort,
  MigrationCatalogPort,
  MigrationExecutionPorts,
  MigrationRowSecurityPort,
  MigrationTransaction,
  PublicationRequest,
} from "./ports.js";

/** Catalog publication work must run inside the caller's migration transaction. */
export interface PublicationPorts {
  readonly catalog: MigrationCatalogPort;
  readonly audit: MigrationAuditPort;
  readonly rowSecurity: MigrationRowSecurityPort;
}

export interface PublicationResult {
  readonly publicationId: PublicationId;
  readonly publishedVersion: number;
  readonly auditEventId: AuditEventId;
}

/**
 * TODO(implementation): compare-and-swap a live catalog version and append its audit event.
 * Input: Plan-bound next snapshot, an open transaction, and catalog/audit/RLS ports.
 * Output: New publication/version/audit ids; the enclosing executor still controls commit.
 * Errors: Throws on stale versions, tenant mismatch, RLS failure, or audit insertion failure.
 * Depends on: `meta.definition_versions`, optimistic locking, and the migration transaction.
 */
export function publishTableDefinition(
  _request: PublicationRequest,
  _transaction: MigrationTransaction,
  _ports: PublicationPorts,
): Promise<PublicationResult> {
  throw new Error("TODO(implementation): publishTableDefinition");
}

/** Rollback publishes a new version; it never rewrites or deletes audit history. */
export interface RollbackRequest {
  readonly context: OperationContext;
  readonly tableId: TableId;
  readonly targetVersion: number;
  readonly expectedCurrentVersion: number;
  readonly plan: MigrationPlan;
  readonly acknowledgement: DestructiveChangeAcknowledgement | null;
}

export interface RollbackResult {
  readonly execution: MigrationExecutionResult;
  readonly rolledBackFromVersion: number;
  readonly restoredSourceVersion: number;
  readonly newLiveVersion: number;
}

/**
 * TODO(implementation): validate and execute a previewed forward migration restoring history.
 * Input: Tenant-bound target version, digest-approved rollback plan, and execution ports.
 * Output: A new audited live version whose contents derive from the rollback target.
 * Errors: Throws on unavailable target, incompatible retained storage, stale version, or failure.
 * Depends on: History loading, plan/digest validation, soft-destructive retention, and RLS.
 */
export function rollbackTableDefinition(
  _request: RollbackRequest,
  _ports: MigrationExecutionPorts,
): Promise<RollbackResult> {
  throw new Error("TODO(implementation): rollbackTableDefinition");
}
