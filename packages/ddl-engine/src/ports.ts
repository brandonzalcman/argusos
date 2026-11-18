import type {
  AuditActor,
  AuditEventId,
  IsoDateTime,
  LiveTableSnapshot,
  MigrationPlanId,
  OperationContext,
  PublicationId,
  TableId,
  TransactionId,
} from "./model.js";
import type {
  ConversionPreflightRequest,
  ConversionPreflightResult,
  MigrationPlan,
} from "./operations.js";
import type { JsonValue, ParameterizedSql } from "./sql.js";

export interface SqlExecutionResult {
  readonly rowCount: number;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

/**
 * Adapter-owned transaction handle. Implementations live outside this package
 * and must use parameterized PostgreSQL calls with no multi-statement driver API.
 */
export interface MigrationTransaction {
  readonly transactionId: TransactionId;

  /**
   * Execute one planned statement inside the enclosing migration transaction.
   * Input: Safety-checked parameterized SQL and its out-of-band values.
   * Output: Driver row metadata used by guards and verification steps.
   * Errors: Throws and marks the transaction for rollback on any PostgreSQL error.
   * Depends on: An authorized, RLS-bound connection; never a superuser bypass.
   */
  execute(statement: ParameterizedSql): Promise<SqlExecutionResult>;

  /**
   * Run a read-only preflight or verification query in the same tenant scope.
   * Input: Parameterized SQL with no data-modifying CTE or multi-statement text.
   * Output: Unknown rows that the caller must validate before use.
   * Errors: Throws on unsafe statements, authorization failures, or driver errors.
   * Depends on: The same transaction and session bindings as migration execution.
   */
  query(statement: ParameterizedSql): Promise<SqlExecutionResult>;
}

/** Locking and optimistic-concurrency requirements for one atomic migration. */
export interface TransactionBoundary {
  readonly context: OperationContext;
  readonly tableId: TableId;
  readonly expectedLiveVersion: number | null;
  readonly lock: "catalog-and-table" | "catalog-only";
  readonly blockDuringActiveIncident: boolean;
}

/** Opens transactions but delegates commit/rollback mechanics to infrastructure. */
export interface MigrationTransactionPort {
  /**
   * Execute all supplied work in one transaction and roll back every effect on failure.
   * Input: Tenant/incident lock requirements and a callback receiving one transaction.
   * Output: The callback result only after DDL, catalog, audit, and RLS work commits.
   * Errors: Rolls back and throws on callback, lock, version, or commit failure.
   * Depends on: PostgreSQL transactional DDL, session RLS bindings, and catalog locking.
   */
  run<Result>(
    boundary: TransactionBoundary,
    work: (transaction: MigrationTransaction) => Promise<Result>,
  ): Promise<Result>;
}

/** Optimistic publication write coupled to the migration transaction. */
export interface PublishedCatalogWrite {
  readonly publicationId: PublicationId;
  readonly planId: MigrationPlanId;
  readonly snapshot: LiveTableSnapshot;
  readonly expectedPreviousVersion: number | null;
}

/** Catalog persistence port; tenant predicates are mandatory in every method. */
export interface MigrationCatalogPort {
  /**
   * Load the current live snapshot under the caller's tenant and transaction lock.
   * Input: Tenant-bound operation context and table id.
   * Output: The current live version, or null before initial publication.
   * Errors: Throws on tenant mismatch, unauthorized reads, or persistence failure.
   * Depends on: `meta` catalog tables and the enclosing migration transaction.
   */
  loadLive(
    context: OperationContext,
    tableId: TableId,
    transaction: MigrationTransaction,
  ): Promise<LiveTableSnapshot | null>;

  /**
   * Load an immutable historical version as a rollback candidate, never as an overwrite.
   * Input: Tenant-bound context, table id, and exact version.
   * Output: The historical snapshot or null when no such tenant-owned version exists.
   * Errors: Throws on authorization or persistence failures.
   * Depends on: Append-only `meta.definition_versions` history.
   */
  loadVersion(
    context: OperationContext,
    tableId: TableId,
    version: number,
    transaction: MigrationTransaction,
  ): Promise<LiveTableSnapshot | null>;

  /**
   * Compare-and-swap the live pointer while retaining all historical versions.
   * Input: An expected version and fully audited publication snapshot.
   * Output: Resolves only when the new live pointer is transactionally persisted.
   * Errors: Throws `OPTIMISTIC_VERSION_CONFLICT` or authorization/persistence errors.
   * Depends on: Database constraints for tenant, version, and publication uniqueness.
   */
  compareAndSwapLive(
    context: OperationContext,
    write: PublishedCatalogWrite,
    transaction: MigrationTransaction,
  ): Promise<void>;
}

/** Redacted, append-only audit payload for publish, rollback, and retention events. */
export interface MigrationAuditEvent {
  readonly context: OperationContext;
  readonly tableId: TableId;
  readonly planId: MigrationPlanId | null;
  readonly publicationId: PublicationId | null;
  readonly action: "publish" | "rollback" | "retention-tombstone" | "retention-purge";
  readonly actor: AuditActor;
  readonly occurredAt: IsoDateTime;
  readonly payload: JsonValue;
}

/** Audit port writes in the same transaction as the event being audited. */
export interface MigrationAuditPort {
  /**
   * Append one redacted event without update or delete capabilities.
   * Input: Tenant/incident/actor-bound event and the enclosing transaction.
   * Output: The immutable audit event id after transactional insertion.
   * Errors: Throws and aborts the migration when the audit event cannot be written.
   * Depends on: Partitioned append-only audit storage and request-id constraints.
   */
  append(event: MigrationAuditEvent, transaction: MigrationTransaction): Promise<AuditEventId>;
}

/** Session claims required by PostgreSQL RLS; values are set with parameterized APIs. */
export interface RowSecuritySessionBinding {
  readonly tenantId: OperationContext["tenantId"];
  readonly incidentId: OperationContext["activeIncidentId"];
  readonly actor: AuditActor;
}

/** Database RLS hook prevents API-only tenant or incident enforcement. */
export interface MigrationRowSecurityPort {
  /**
   * Bind and verify tenant, actor, position, and incident claims for this transaction.
   * Input: Trusted server-derived claims, never raw request-provided session settings.
   * Output: Resolves after the transaction-local bindings are enforced.
   * Errors: Throws on missing claims, incident mismatch, or attempted RLS bypass.
   * Depends on: PostgreSQL RLS policies and a non-`BYPASSRLS` execution role.
   */
  bindSession(binding: RowSecuritySessionBinding, transaction: MigrationTransaction): Promise<void>;

  /**
   * Verify table policies and audit triggers before catalog publication.
   * Input: The candidate live snapshot and its transactionally migrated table.
   * Output: Resolves only when tenant/incident RLS and append-only audit are effective.
   * Errors: Throws and rolls back if policies or triggers are absent or weakened.
   * Depends on: PostgreSQL policy catalogs plus incident/global isolation probes.
   */
  verifyTable(snapshot: LiveTableSnapshot, transaction: MigrationTransaction): Promise<void>;
}

/** Read-only database adapter used before a conversion plan may be published. */
export interface ConversionPreflightPort {
  /**
   * Count and sample conversion failures under the table's actual tenant/RLS scope.
   * Input: A conversion operation reference and bounded row-sample request.
   * Output: Counts and redacted record-id samples without mutating any rows.
   * Errors: Throws on unsupported conversions, stale snapshots, or authorization errors.
   * Depends on: Field-type conversion registry and a read-only PostgreSQL transaction.
   */
  inspect(request: ConversionPreflightRequest): Promise<ConversionPreflightResult>;
}

/** Infrastructure dependencies required by the transactional execution stub. */
export interface MigrationExecutionPorts {
  readonly transactions: MigrationTransactionPort;
  readonly catalog: MigrationCatalogPort;
  readonly audit: MigrationAuditPort;
  readonly rowSecurity: MigrationRowSecurityPort;
}

/** Publication artifact shared by execution and rollback orchestration. */
export interface PublicationRequest {
  readonly context: OperationContext;
  readonly plan: MigrationPlan;
  readonly nextSnapshot: LiveTableSnapshot;
}
