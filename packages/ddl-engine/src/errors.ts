import type { MigrationPlanId, TableId, TenantId } from "./model.js";

/** Stable machine-readable failures exposed by DDL planning and execution. */
export type DdlEngineErrorCode =
  | "TENANT_MISMATCH"
  | "INCIDENT_SCOPE_MISMATCH"
  | "OPTIMISTIC_VERSION_CONFLICT"
  | "UNSAFE_IDENTIFIER"
  | "UNSAFE_SQL"
  | "UNSUPPORTED_CONVERSION"
  | "CONVERSION_PREFLIGHT_FAILED"
  | "DESTRUCTIVE_ACKNOWLEDGEMENT_REQUIRED"
  | "RETENTION_NOT_EXPIRED"
  | "ACTIVE_INCIDENT_LOCK_BLOCKED"
  | "TRANSACTION_ABORTED"
  | "ROLLBACK_NOT_AVAILABLE"
  | "AUTHORIZATION_FAILED";

/** Structured error details safe for logs; raw row values and secrets are excluded. */
export interface DdlEngineErrorDetails {
  readonly tenantId?: TenantId;
  readonly tableId?: TableId;
  readonly planId?: MigrationPlanId;
  readonly operationIds?: readonly string[];
  readonly cause?: unknown;
}

/** Base public error for adapters to map to API and job failures. */
export class DdlEngineError extends Error {
  public readonly code: DdlEngineErrorCode;
  public readonly details: DdlEngineErrorDetails;

  public constructor(
    code: DdlEngineErrorCode,
    message: string,
    details: DdlEngineErrorDetails = {},
  ) {
    super(message);
    this.name = "DdlEngineError";
    this.code = code;
    this.details = details;
  }
}
