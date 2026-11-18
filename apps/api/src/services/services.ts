import type { RequestContext } from "../http/request-context.js";
import type {
  CatalogEntity,
  RecordEntity,
  RepositoryPage,
  SystemRepositories,
} from "../persistence/repositories.js";

export interface DefinitionDocument {
  readonly kind: "table" | "board" | "workflow" | "menu" | "theme" | "homepage";
  readonly key: string;
  readonly revision: number;
  readonly state: "draft" | "published" | "retired";
  readonly document: Readonly<Record<string, unknown>>;
}

export interface RecordWrite {
  readonly tableId: string;
  readonly incidentId: string | null;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface FileUploadIntent {
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly incidentId: string | null;
}

export interface FileUploadGrant {
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

export interface PublicFormDecision {
  readonly submissionId: string;
  readonly decision: "approve" | "reject";
  readonly reason: string | null;
}

export interface ApiKeyIssueInput {
  readonly name: string;
  readonly scopes: readonly string[];
  readonly incidentIds: readonly string[] | null;
  readonly expiresAt: Date;
}

export interface IssuedApiKey {
  readonly metadata: CatalogEntity;
  readonly secret: string;
}

export interface HealthReport {
  readonly status: "ok" | "degraded" | "unavailable";
  readonly checks: Readonly<Record<string, "ok" | "failed">>;
}

export interface AuthService {
  /** Return the current verified identity; never accept identity changes through this read method. */
  current(context: RequestContext): Promise<RequestContext>;
  /** Select an assigned position and emit an audited session-context change, or reject the assignment. */
  selectPosition(context: RequestContext, positionId: string): Promise<RequestContext>;
  /** Revoke the current session; resolves after revocation and audit persistence or throws a safe error. */
  signOut(context: RequestContext): Promise<void>;
}

export interface TenantService {
  /** Read the caller's FLS-filtered tenant or throw a non-enumerating not-found error. */
  current(context: RequestContext): Promise<CatalogEntity>;
  /** Update permitted tenant settings using expectedVersion; audit actor, position, request, and diff. */
  update(
    context: RequestContext,
    settings: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<CatalogEntity>;
}

export interface PositionService {
  /** List positions visible to the caller; user assignment does not imply definition-admin access. */
  list(context: RequestContext): Promise<readonly CatalogEntity[]>;
  /** Assign a position to a user with validity bounds; requires tenant administration and audit. */
  assign(context: RequestContext, userId: string, positionId: string): Promise<void>;
}

export interface IncidentService {
  /** List live/exercise incidents visible to the active position without crossing tenant boundaries. */
  list(context: RequestContext): Promise<readonly CatalogEntity[]>;
  /** Activate a draft incident with optimistic concurrency and an audited status transition. */
  activate(
    context: RequestContext,
    incidentId: string,
    expectedVersion: number,
  ): Promise<CatalogEntity>;
  /** Archive an accessible incident after dependency checks; does not delete legal/audit records. */
  archive(
    context: RequestContext,
    incidentId: string,
    expectedVersion: number,
  ): Promise<CatalogEntity>;
}

export interface MetaDefinitionService {
  /** Read an authorized draft/published definition without exposing restricted fields. */
  get(context: RequestContext, kind: string, key: string): Promise<DefinitionDocument>;
  /** Validate and publish a versioned definition atomically with its migration plan and audit event. */
  publish(
    context: RequestContext,
    definition: DefinitionDocument,
    expectedRevision: number,
  ): Promise<DefinitionDocument>;
}

export interface RecordService {
  /** List one stable page from a physical table after table, incident, row, and field authorization. */
  list(
    context: RequestContext,
    tableId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RepositoryPage<RecordEntity>>;
  /** Create a user-table record with server-owned audit columns and validated field values. */
  create(context: RequestContext, input: RecordWrite): Promise<RecordEntity>;
  /** Patch allowed fields with optimistic concurrency and per-field immutable audit diffs. */
  update(
    context: RequestContext,
    tableId: string,
    recordId: string,
    values: Readonly<Record<string, unknown>>,
    expectedVersion: number,
  ): Promise<RecordEntity>;
}

export interface ViewService {
  /** Save a personal/shared view definition with expectedVersion and position-based sharing checks. */
  save(
    context: RequestContext,
    view: Readonly<Record<string, unknown>>,
    expectedVersion: number | null,
  ): Promise<CatalogEntity>;
}

export interface FileService {
  /** Create a short-lived upload grant after quota, type, size, tenant, and incident authorization. */
  requestUpload(context: RequestContext, input: FileUploadIntent): Promise<FileUploadGrant>;
  /** Complete a quarantined upload only after malware/type checks and persist an audited attachment. */
  completeUpload(context: RequestContext, fileId: string): Promise<CatalogEntity>;
}

export interface PublicFormReviewService {
  /** List pending submissions visible to the reviewer; sensitive values remain subject to FLS. */
  listPending(context: RequestContext): Promise<readonly CatalogEntity[]>;
  /** Approve into the intended incident or reject with reason, atomically recording reviewer audit. */
  decide(context: RequestContext, decision: PublicFormDecision): Promise<CatalogEntity>;
}

export interface ApiKeyService {
  /** Issue a hashed, scoped key; the plaintext secret is returned once and never logged or persisted. */
  issue(context: RequestContext, input: ApiKeyIssueInput): Promise<IssuedApiKey>;
  /** Revoke a tenant-owned key and audit the actor; revocation also affects realtime and worker access. */
  revoke(context: RequestContext, apiKeyId: string): Promise<void>;
}

export interface HealthService {
  /** Report process liveness without performing external checks or exposing internals. */
  live(): Promise<HealthReport>;
  /** Report readiness using bounded dependency checks and no secrets, table data, or internal URLs. */
  ready(context: RequestContext | null): Promise<HealthReport>;
}

export interface ApiServices {
  readonly auth: AuthService;
  readonly tenants: TenantService;
  readonly positions: PositionService;
  readonly incidents: IncidentService;
  readonly definitions: MetaDefinitionService;
  readonly records: RecordService;
  readonly views: ViewService;
  readonly files: FileService;
  readonly publicFormReview: PublicFormReviewService;
  readonly apiKeys: ApiKeyService;
  readonly health: HealthService;
}

/**
 * TODO(implementation): compose domain services over scoped repositories and policy/audit ports.
 * Input: Drizzle repository collection; identity, object-storage, and policy ports are added by composition.
 * Output: the complete application service surface shared by tRPC and REST.
 * Errors: throws when mandatory authorization, audit, storage, or repository dependencies are absent.
 * Depends on: RLS/FLS repositories, DDL engine, schema validators, object storage, and audit infrastructure.
 * Security: services are the common authorization boundary; transport handlers must not bypass them.
 */
export function createApiServices(_repositories: SystemRepositories): ApiServices {
  throw new Error("TODO(implementation): createApiServices");
}
