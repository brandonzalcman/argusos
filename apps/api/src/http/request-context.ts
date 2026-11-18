import type { FastifyRequest } from "fastify";
import type { BetterAuthPort } from "../auth/ports.js";

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly authKind: "session" | "api-key";
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string | null;
  readonly activeIncidentId: string | null;
  readonly sessionId: string | null;
  readonly apiKeyId: string | null;
  readonly grantedCapabilities: readonly string[];
  readonly authenticatedAt: Date;
  readonly sessionExpiresAt: Date | null;
}

export interface RequestAuthenticationPorts {
  readonly betterAuth: BetterAuthPort;
}

/**
 * TODO(implementation): derive the immutable authorization and audit context for every API request.
 * Input: a Fastify request and server-side authentication ports.
 * Output: a verified RequestContext attached to the request lifecycle.
 * Errors: throws mapped 401/403 errors for invalid, expired, revoked, or out-of-scope credentials.
 * Depends on: Better Auth, scoped API-key verification, position assignments, and incident membership.
 * Security: ignores spoofable tenant/position headers unless signed by a trusted internal boundary and
 * revalidates incident access; request and correlation IDs are included in immutable audit records.
 */
export function resolveRequestContext(
  _request: FastifyRequest,
  _ports: RequestAuthenticationPorts,
): Promise<RequestContext> {
  throw new Error("TODO(implementation): resolveRequestContext");
}

/**
 * TODO(implementation): require an explicitly selected incident for an incident-scoped operation.
 * Input: a previously authenticated RequestContext.
 * Output: narrows activeIncidentId to a non-null string when incident access is valid.
 * Errors: throws a mapped 400/403 error when no incident is selected or access is denied.
 * Depends on: resolveRequestContext and current incident membership/status repositories.
 * Security: prevents accidental global queries and keeps live and exercise data isolated.
 */
export function requireIncidentContext(
  _context: RequestContext,
): asserts _context is RequestContext & { readonly activeIncidentId: string } {
  throw new Error("TODO(implementation): requireIncidentContext");
}
