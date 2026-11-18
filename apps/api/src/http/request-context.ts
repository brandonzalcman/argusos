import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { BetterAuthPort } from "../auth/ports.js";
import type { Database } from "../db/client.js";
import { withTenantTransaction } from "../db/transaction.js";
import { apiError } from "../errors.js";
import { incidents, sessionContexts } from "../persistence/system-schema.js";

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly authKind: "session" | "api-key";
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string;
  readonly activeIncidentId: string | null;
  readonly sessionId: string | null;
  readonly apiKeyId: string | null;
  readonly grantedCapabilities: readonly string[];
  readonly authenticatedAt: Date;
  readonly sessionExpiresAt: Date | null;
}

export interface RequestAuthenticationPorts {
  readonly betterAuth: BetterAuthPort;
  /** Used for the server-side session context (selected position/incident). */
  readonly database: Database;
}

const uuidSchema = z.string().uuid();

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Per-request identifiers. The request id is the (server-generated) Fastify request id; the
 * correlation id is the incoming `x-correlation-id` only when it is a UUID, else the request id.
 */
export function requestIdentifiers(request: FastifyRequest): {
  requestId: string;
  correlationId: string;
} {
  const requestId = uuidSchema.safeParse(request.id).success ? request.id : randomUUID();
  const incoming = firstHeader(request.headers["x-correlation-id"]);
  const correlationId =
    incoming !== null && uuidSchema.safeParse(incoming).success ? incoming : requestId;
  return { requestId, correlationId };
}

/**
 * Derive the immutable authorization and audit context for a request, or null when there is no valid
 * authenticated session (anonymous, expired, revoked, disabled user, suspended tenant).
 *
 * Tenant, user and position come only from the verified Better Auth session and server-side
 * mappings; request headers and bodies are never consulted for them. The selected position and
 * incident live in `meta.session_contexts` keyed by the Better Auth session id: on the first request
 * the first currently valid assignment (ordered by position key) is chosen and persisted; a stored
 * position that is no longer assigned falls back the same way; a stored incident is re-checked
 * (same tenant, not archived) and cleared when it no longer qualifies.
 * Errors: `forbidden` when the user has no currently valid position assignment.
 */
export async function tryResolveRequestContext(
  request: FastifyRequest,
  ports: RequestAuthenticationPorts,
): Promise<RequestContext | null> {
  const { requestId, correlationId } = requestIdentifiers(request);
  const identity = await ports.betterAuth.resolveSession({
    cookieHeader: firstHeader(request.headers.cookie),
    requestOrigin: firstHeader(request.headers.origin),
    ipAddress: request.ip,
    userAgent: firstHeader(request.headers["user-agent"]),
  });
  if (identity === null) return null;

  const firstPositionId = identity.positionIds[0];
  if (firstPositionId === undefined) {
    throw apiError("forbidden", "No position assignment.");
  }

  const selection = await withTenantTransaction(
    ports.database,
    {
      tenantId: identity.tenantId,
      userId: identity.userId,
      positionId: firstPositionId,
      requestId,
    },
    async (tx) => {
      const [stored] = await tx
        .select()
        .from(sessionContexts)
        .where(
          and(
            eq(sessionContexts.authSessionId, identity.sessionId),
            eq(sessionContexts.tenantId, identity.tenantId),
            eq(sessionContexts.userId, identity.userId),
          ),
        );

      const positionId =
        stored !== undefined && identity.positionIds.includes(stored.positionId)
          ? stored.positionId
          : firstPositionId;

      let incidentId: string | null = null;
      if (stored?.incidentId != null) {
        const [incident] = await tx
          .select({ id: incidents.id })
          .from(incidents)
          .where(
            and(
              eq(incidents.id, stored.incidentId),
              eq(incidents.tenantId, identity.tenantId),
              ne(incidents.status, "archived"),
            ),
          );
        incidentId = incident?.id ?? null;
      }

      if (stored === undefined) {
        await tx
          .insert(sessionContexts)
          .values({
            authSessionId: identity.sessionId,
            tenantId: identity.tenantId,
            userId: identity.userId,
            positionId,
            incidentId: null,
          })
          .onConflictDoNothing();
      } else if (stored.positionId !== positionId || stored.incidentId !== incidentId) {
        await tx
          .update(sessionContexts)
          .set({ positionId, incidentId, updatedAt: new Date(), version: stored.version + 1 })
          .where(
            and(
              eq(sessionContexts.authSessionId, identity.sessionId),
              eq(sessionContexts.version, stored.version),
            ),
          );
      }
      return { positionId, incidentId };
    },
  );

  return {
    requestId,
    correlationId,
    authKind: "session",
    tenantId: identity.tenantId,
    userId: identity.userId,
    positionId: selection.positionId,
    activeIncidentId: selection.incidentId,
    sessionId: identity.sessionId,
    apiKeyId: null,
    grantedCapabilities: [],
    authenticatedAt: identity.authenticatedAt,
    sessionExpiresAt: identity.sessionExpiresAt,
  };
}

/**
 * Like {@link tryResolveRequestContext} but throws `unauthenticated` (401) when there is no valid
 * session. Use for handlers that cannot serve anonymous callers.
 */
export async function resolveRequestContext(
  request: FastifyRequest,
  ports: RequestAuthenticationPorts,
): Promise<RequestContext> {
  const context = await tryResolveRequestContext(request, ports);
  if (context === null) throw apiError("unauthenticated", "Authentication is required.");
  return context;
}

/**
 * Require an explicitly selected incident for an incident-scoped operation.
 * Errors: `incident-scope-required` when no incident is selected. The selected incident was
 * re-validated (same tenant, not archived) when the context was resolved for this request.
 */
export function requireIncidentContext(
  context: RequestContext,
): asserts context is RequestContext & { readonly activeIncidentId: string } {
  if (context.activeIncidentId === null) {
    throw apiError("incident-scope-required", "Select an incident to continue.");
  }
}
