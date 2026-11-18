/**
 * Local identity ports for catalog values. These are deliberately narrow until
 * `@argus/schema` exports its canonical branded identifiers; adapters should
 * validate and convert schema values at the package boundary.
 */
declare const localIdBrand: unique symbol;

export type LocalId<Name extends string> = string & {
  readonly [localIdBrand]: Name;
};

export type TenantId = LocalId<"TenantId">;
export type TableId = LocalId<"TableId">;
export type FieldId = LocalId<"FieldId">;
export type IncidentId = LocalId<"IncidentId">;
export type UserId = LocalId<"UserId">;
export type PositionId = LocalId<"PositionId">;
export type RequestId = LocalId<"RequestId">;
export type CorrelationId = LocalId<"CorrelationId">;
export type MigrationPlanId = LocalId<"MigrationPlanId">;
export type PublicationId = LocalId<"PublicationId">;
export type AuditEventId = LocalId<"AuditEventId">;
export type TransactionId = LocalId<"TransactionId">;

/** An ISO-8601 timestamp supplied by an adapter's trusted clock. */
export type IsoDateTime = LocalId<"IsoDateTime">;

/** Whether rows belong to one incident or are shared across a tenant. */
export type TableDataScope = "incident" | "global";

/** The actor and request identity copied into every mutation and audit event. */
export interface AuditActor {
  readonly kind: "user" | "api-key" | "system-job";
  readonly userId: UserId | null;
  readonly positionId: PositionId | null;
  readonly credentialId: string | null;
}

/**
 * Security context required by every public operation. `activeIncidentId` is
 * the operator's current incident for lock policy and audit; it never weakens
 * the tenant boundary or turns a global table into an incident-scoped table.
 */
export interface OperationContext {
  readonly tenantId: TenantId;
  readonly activeIncidentId: IncidentId | null;
  readonly actor: AuditActor;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly reason: string;
}

/**
 * Integration port for the field-types registry. The registry validates the
 * plugin configuration and supplies conversion/index capabilities; raw
 * PostgreSQL type names or SQL fragments are not accepted here.
 */
export interface FieldTypeReference {
  readonly pluginId: string;
  readonly pluginVersion: number;
  readonly configuration: Readonly<Record<string, unknown>>;
}

/**
 * Integration port for `@argus/schema` expression definitions and
 * `@argus/expr`. It carries source identity, not executable SQL.
 */
export interface ExpressionSourceReference {
  readonly expressionId: string;
  readonly source: string;
  readonly expectedType: string;
  readonly revision: number;
}

/** Immutable field metadata; display-name changes must not rename storage. */
export interface FieldSnapshot {
  readonly fieldId: FieldId;
  readonly key: string;
  readonly displayName: string;
  readonly columnName: string;
  readonly type: FieldTypeReference;
  readonly storage: "column" | "generated-column" | "view-only";
  readonly nullable: boolean;
  readonly defaultExpression: ExpressionSourceReference | null;
  readonly formulaExpression: ExpressionSourceReference | null;
  readonly sensitivity: "standard" | "personal" | "sensitive";
  readonly hiddenAt: IsoDateTime | null;
}

/** Index definition expressed as catalog metadata rather than raw SQL. */
export interface IndexSnapshot {
  readonly indexId: string;
  readonly name: string;
  readonly fieldIds: readonly FieldId[];
  readonly unique: boolean;
  readonly method: "btree" | "gin" | "gist" | "brin";
  readonly predicateExpression: ExpressionSourceReference | null;
}

/** Relation metadata; junction storage is allocated only by the DDL planner. */
export interface RelationSnapshot {
  readonly relationId: string;
  readonly fieldId: FieldId;
  readonly targetTableId: TableId;
  readonly cardinality: "one-to-many" | "many-to-one" | "many-to-many";
  readonly onDelete: "restrict" | "soft-delete";
  readonly junctionTableShortId: string | null;
}

/** Soft-destructive retention rules applied to table and field removal. */
export interface DestructiveRetentionPolicy {
  readonly retentionDays: number;
  readonly tombstonePrefix: "_deleted_";
  readonly hardDelete: "after-retention-with-approval";
}

/** Append-only history requirements inherited by every physical table. */
export interface TableAuditPolicy {
  readonly history: "append-only";
  readonly captureFieldDiffs: true;
  readonly includeRequestId: true;
  readonly sensitiveValues: "redact" | "hash";
}

/**
 * Database-enforced RLS metadata. Incident-scoped tables require an incident
 * binding in addition to tenant/session bindings; global tables still require
 * tenant isolation and position-aware policies.
 */
export interface RowLevelSecuritySnapshot {
  readonly enabled: true;
  readonly forceForTableOwners: boolean;
  readonly incidentBinding: "required" | "not-applicable";
  readonly positionPolicyExpression: ExpressionSourceReference | null;
}

/** The version-independent contents of a configurable user table. */
export interface TableDefinition {
  readonly tenantId: TenantId;
  readonly tableId: TableId;
  readonly shortId: string;
  readonly displayName: string;
  readonly scope: TableDataScope;
  readonly fields: readonly FieldSnapshot[];
  readonly indexes: readonly IndexSnapshot[];
  readonly relations: readonly RelationSnapshot[];
  readonly destructiveRetention: DestructiveRetentionPolicy;
  readonly audit: TableAuditPolicy;
  readonly rls: RowLevelSecuritySnapshot;
}

/** A mutable catalog draft tied optimistically to the live version it edited. */
export interface DraftTableSnapshot {
  readonly kind: "draft";
  readonly definition: TableDefinition;
  readonly draftRevision: number;
  readonly basedOnLiveVersion: number | null;
}

/** An immutable, published catalog version used as the migration baseline. */
export interface LiveTableSnapshot {
  readonly kind: "live";
  readonly definition: TableDefinition;
  readonly version: number;
  readonly publicationId: PublicationId;
  readonly publishedAt: IsoDateTime;
  readonly publishedBy: AuditActor;
}

/** Diff input for initial table creation (`live` is null) or later changes. */
export interface TableSnapshotPair {
  readonly live: LiveTableSnapshot | null;
  readonly draft: DraftTableSnapshot;
}
