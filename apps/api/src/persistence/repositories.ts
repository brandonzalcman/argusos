import type { RequestContext } from "../http/request-context.js";

export interface RepositoryScope {
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly userId: string;
  readonly positionId: string;
  readonly requestId: string;
}

export interface RepositoryPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface CatalogEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RecordEntity extends CatalogEntity {
  readonly tableId: string;
  readonly incidentId: string | null;
  readonly deletedAt: Date | null;
  readonly values: Readonly<Record<string, unknown>>;
}

export type CreateCatalogEntity<T extends CatalogEntity> = Omit<
  T,
  "id" | "tenantId" | "version" | "createdAt" | "updatedAt"
>;

/*
 * Per-entity patch types. They list only the columns a caller may change. Identity (id), ownership
 * (tenantId), optimistic version, timestamps, soft-delete/tombstone and incident/position scoping
 * columns are deliberately absent: the repository owns them. There is no generic "partial entity"
 * update type because it would allow patching those protected columns.
 */
export interface TenantPatch {
  readonly name?: string;
  readonly status?: "active" | "suspended" | "archived";
}
export interface UserPatch {
  readonly displayName?: string;
  readonly email?: string | null;
  readonly status?: "invited" | "active" | "disabled";
}
export interface PositionPatch {
  readonly name?: string;
  readonly description?: string | null;
  readonly homepageBoardId?: string | null;
  readonly studioView?: boolean;
  readonly studioEdit?: boolean;
  readonly studioPublish?: boolean;
  readonly studioEditCode?: boolean;
}
export interface IncidentPatch {
  readonly name?: string;
  readonly status?: "planned" | "active" | "monitoring" | "closed" | "archived";
  readonly level?: number | null;
  readonly operationalPeriod?: string | null;
}
export interface DefinitionPatch {
  readonly name?: string;
  readonly description?: string | null;
}
/** Record values only; table, incident scope, deletion state and audit columns are never patchable. */
export interface RecordPatch {
  readonly values: Readonly<Record<string, unknown>>;
}
/** Review decisions go through dedicated workflow methods, never a generic patch. */
export type NoPatch = Readonly<Record<string, never>>;

/** Database port whose implementation must set authenticated RLS claims for every transaction. */
export interface ScopedRepository<
  T extends CatalogEntity,
  TUpdate,
  TCreate = CreateCatalogEntity<T>,
> {
  /**
   * Find one authorized entity by immutable ID.
   * Input: tenant/incident actor scope and entity ID.
   * Output: the FLS-filtered entity or null when absent or not visible.
   * Errors: throws for infrastructure failures; never reveals cross-tenant existence.
   * Depends on: Drizzle, RLS session claims, position ABAC, and field-level policy.
   */
  findById(scope: RepositoryScope, id: string): Promise<T | null>;

  /**
   * List one stable, authorized page.
   * Input: actor scope, opaque cursor, and bounded page size.
   * Output: visible records and an optional next cursor.
   * Errors: throws for invalid cursors, excessive limits, or database failures.
   * Depends on: deterministic ordering, RLS/FLS, incident scope, and soft-delete policy.
   */
  list(scope: RepositoryScope, cursor: string | null, limit: number): Promise<RepositoryPage<T>>;

  /**
   * Create an entity and its append-only audit event atomically.
   * Input: actor scope and validated domain input without client-supplied ownership/audit fields.
   * Output: the authorized created entity at version one.
   * Errors: throws validation, uniqueness, authorization, or persistence errors.
   * Depends on: RLS transaction, domain validation, and audit triggers.
   */
  create(scope: RepositoryScope, input: TCreate): Promise<T>;

  /**
   * Update an entity with optimistic concurrency and append-only field-level audit history.
   * Input: actor scope, ID, validated patch, and the version previously read by the caller.
   * Output: the FLS-filtered updated entity with an incremented version.
   * Errors: throws not-found, forbidden, or version-conflict errors without leaking inaccessible rows.
   * Depends on: RLS/FLS transaction, field write policy, audit triggers, and request attribution.
   */
  update(scope: RepositoryScope, id: string, input: TUpdate, expectedVersion: number): Promise<T>;
}

export interface SystemRepositories {
  readonly tenants: ScopedRepository<CatalogEntity, TenantPatch>;
  readonly users: ScopedRepository<CatalogEntity, UserPatch>;
  readonly positions: ScopedRepository<CatalogEntity, PositionPatch>;
  readonly incidents: ScopedRepository<CatalogEntity, IncidentPatch>;
  readonly definitions: ScopedRepository<CatalogEntity, DefinitionPatch>;
  readonly views: ScopedRepository<CatalogEntity, DefinitionPatch>;
  readonly records: ScopedRepository<RecordEntity, RecordPatch>;
  readonly publicFormReviews: ScopedRepository<CatalogEntity, NoPatch>;
  readonly apiKeys: ScopedRepository<CatalogEntity, NoPatch>;
}

/**
 * TODO(implementation): create Drizzle-backed repositories without executing queries during composition.
 * Input: a configured least-privilege database port supplied by the composition root.
 * Output: repositories that derive scope only from RequestContext.
 * Errors: throws when required database or audit/RLS ports are unavailable.
 * Depends on: PostgreSQL 18, Drizzle migrations, RLS/FLS policy services, and DDL-engine table metadata.
 * Security: every method must use tenant isolation, incident scope, field security, audit, and versions.
 */
export function createSystemRepositories(_database: unknown): SystemRepositories {
  throw new Error("TODO(implementation): createSystemRepositories");
}

/**
 * TODO(implementation): derive repository scope from verified request context.
 * Input: an authenticated RequestContext.
 * Output: immutable scope for one repository transaction.
 * Errors: throws if the request has no authenticated tenant/user identity.
 * Depends on: request authentication and active-position validation.
 * Security: callers must never construct this scope from request body fields.
 */
export function repositoryScopeFromContext(_context: RequestContext): RepositoryScope {
  throw new Error("TODO(implementation): repositoryScopeFromContext");
}
