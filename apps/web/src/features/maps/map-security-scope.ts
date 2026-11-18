import type { MapAuditContext, MapSecurityScope } from "@argus/maps";
import type { AppScope } from "../../services/contracts.js";

/** Authenticated identity the map adapter needs beyond the tenant/incident scope. */
export interface MapSession {
  readonly userId: string;
  readonly positionId: string;
  /** When the session was authenticated, as reported by the server; never invented client-side. */
  readonly authenticatedAt: string;
}

/**
 * TODO(implementation): return the authenticated user, position and authentication time.
 * Input: none; reads the session provider once it exists (web has no actor provider today).
 * Output: the MapSession, or null while unauthenticated.
 * Errors: none; null keeps the map renderer off.
 * Depends on: session provider in app-providers and apps/api membership checks.
 */
export function useMapSession(): MapSession | null {
  return null;
}

/**
 * Builds the server-shaped operation context the map adapter requires.
 * Input: the active AppScope, the session and a request id.
 * Output: a MapSecurityScope, or null when either the scope or the session is missing.
 * Errors: none; callers must not create a map without a context.
 * Depends on: @argus/maps MapSecurityScope (= OperationContext).
 */
export function toMapSecurityScope(
  scope: AppScope | null,
  session: MapSession | null,
  requestId: string,
): MapSecurityScope | null {
  if (scope === null || session === null) return null;
  return {
    tenantId: scope.tenantId,
    incidentId: scope.incidentId,
    userId: session.userId,
    positionId: session.positionId,
    requestId,
    authenticatedAt: session.authenticatedAt,
  };
}

export function mapAudit(definitionVersion: number, correlationId: string): MapAuditContext {
  return { correlationId, definitionVersion };
}
