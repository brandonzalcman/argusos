import type { AnyTRPCRouter } from "@trpc/server";
import type { ApiServices } from "../services/services.js";

/**
 * TODO(implementation): define auth session, position-selection, and sign-out tRPC procedures.
 * Input: verified RequestContext and validated position-selection payloads.
 * Output: transport-safe session DTOs or audited revocation results from ApiServices.auth.
 * Errors: maps authentication and assignment failures to redacted tRPC errors.
 * Depends on: RequestContext middleware, Better Auth, and position assignments.
 */
export function createAuthRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createAuthRouter");
}

/**
 * TODO(implementation): define tenant read and settings-update procedures.
 * Input: verified RequestContext, validated settings, and expected versions.
 * Output: FLS-filtered tenant DTOs from ApiServices.tenants.
 * Errors: returns non-enumerating not-found, forbidden, and conflict errors.
 * Depends on: tenant RBAC/FLS, optimistic versions, and immutable audit.
 */
export function createTenantRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createTenantRouter");
}

/**
 * TODO(implementation): define user/position list and assignment procedures.
 * Input: verified tenant administrator context, user/position IDs, and validity data.
 * Output: visible user/position DTOs and audited assignment results.
 * Errors: rejects cross-tenant IDs, inactive assignments, and insufficient privileges.
 * Depends on: PositionService, membership repositories, and session-context refresh.
 */
export function createPositionRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createPositionRouter");
}

/**
 * TODO(implementation): define incident list, activation, and archive procedures.
 * Input: verified position context, incident IDs, and expected versions.
 * Output: authorized incident DTOs and audited lifecycle transitions.
 * Errors: rejects stale versions, invalid transitions, and inaccessible incidents.
 * Depends on: IncidentService and policies separating live incidents from exercises.
 */
export function createIncidentRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createIncidentRouter");
}

/**
 * TODO(implementation): define metadata draft, diff, and publish procedures.
 * Input: versioned table/board/workflow definitions and expected revisions.
 * Output: validated definition versions and safe migration-plan summaries.
 * Errors: rejects invalid definitions, destructive unsafe plans, and revision conflicts.
 * Depends on: schema validators, DDL engine, MetaDefinitionService, and publish audit.
 */
export function createDefinitionRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createDefinitionRouter");
}

/**
 * TODO(implementation): define generated physical-table record query and mutation procedures.
 * Input: validated table/record IDs, field values, cursors, and expected versions.
 * Output: RLS/FLS-filtered record pages and audited record mutations.
 * Errors: hides inaccessible rows and reports field validation or version conflicts safely.
 * Depends on: RecordService, DDL metadata, field plugins, and tenant/incident policy.
 */
export function createRecordRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createRecordRouter");
}

/**
 * TODO(implementation): define saved-view read and write procedures.
 * Input: validated view definitions, sharing targets, and expected versions.
 * Output: authorized personal or position-shared view DTOs.
 * Errors: rejects cross-tenant sharing, invalid filters, and revision conflicts.
 * Depends on: ViewService, position sharing policy, and definition validation.
 */
export function createViewRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createViewRouter");
}

/**
 * TODO(implementation): define quarantined file-upload intent and completion procedures.
 * Input: validated file metadata and tenant/incident-scoped upload IDs.
 * Output: short-lived upload grants or authorized attachment DTOs.
 * Errors: rejects excess size, disallowed types, failed scans, and expired upload grants.
 * Depends on: FileService, S3-compatible quarantine storage, malware scanning, and audit.
 */
export function createFileRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createFileRouter");
}

/**
 * TODO(implementation): define public-form submission review procedures.
 * Input: reviewer context, quarantined submission IDs, and approve/reject decisions.
 * Output: reviewed submissions and, on approval, separately audited incident record creation.
 * Errors: rejects duplicate decisions, expired submissions, and unauthorized incident writes.
 * Depends on: PublicFormReviewService, RecordService, FLS, and reviewer audit.
 */
export function createPublicFormReviewRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createPublicFormReviewRouter");
}

/**
 * TODO(implementation): define scoped API-key issue, list, and revoke procedures.
 * Input: administrator context, bounded scopes/incidents/expiry, and key IDs.
 * Output: key metadata and a plaintext secret only once at issuance.
 * Errors: rejects privilege escalation, overlong lifetime, and cross-tenant key operations.
 * Depends on: ApiKeyService, secret hashing, revocation propagation, and immutable audit.
 */
export function createApiKeyRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createApiKeyRouter");
}

/**
 * TODO(implementation): define minimal liveness and readiness procedures.
 * Input: an unauthenticated liveness call or bounded readiness dependency checks.
 * Output: aggregate status with redacted dependency names and no operational data.
 * Errors: returns unavailable status without exposing credentials, SQL, or internal URLs.
 * Depends on: HealthService and bounded database/event/storage health ports.
 */
export function createHealthRouter(_services: ApiServices): AnyTRPCRouter {
  throw new Error("TODO(implementation): createHealthRouter");
}
