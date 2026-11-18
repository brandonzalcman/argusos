import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { resultRows } from "../db/client.js";
import { withTenantTransaction } from "../db/transaction.js";
import { positions, tenants, userPositions } from "../persistence/system-schema.js";
import type { BetterAuthInstance } from "./better-auth.js";
import type { AuthenticatedIdentity, BetterAuthPort, OidcProviderPort } from "./ports.js";

export interface BetterAuthAdapterOptions {
  readonly auth: BetterAuthInstance;
  /** System connection; reads go through `argus_app` (identity function) and tenant transactions. */
  readonly database: Database;
}

export interface OidcAdapterOptions {
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly clientSecretRef: string;
  readonly publicOrigin: string;
}

/** Placeholder scope id for the pre-position bootstrap reads; RLS keys on tenant only. */
const NO_POSITION = "00000000-0000-0000-0000-000000000000";

interface ResolvedIdentityRow {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly status: string;
}

/**
 * Map a Better Auth user id to the ArgusOS (tenant, user). Uses the narrow SECURITY DEFINER function
 * `meta.resolve_identity` under `argus_app`: no RLS bypass.
 */
async function resolveIdentity(
  database: Database,
  authUserId: string,
): Promise<ResolvedIdentityRow | null> {
  const rows = await database.transaction(async (tx) => {
    await tx.execute(sql`set local role argus_app`);
    return resultRows<Record<string, unknown>>(
      await tx.execute(
        sql`select tenant_id, user_id, status from meta.resolve_identity(${authUserId})`,
      ),
    );
  });
  const row = rows[0];
  if (row === undefined) return null;
  return {
    tenant_id: String(row.tenant_id),
    user_id: String(row.user_id),
    status: String(row.status),
  };
}

/**
 * Verify the session with Better Auth, then map it to the ArgusOS identity and the position
 * assignments valid right now. Disabled/invited users and non-active tenants resolve to null.
 * Tenant and position come only from server-side mappings, never from the request.
 */
export function createBetterAuthAdapter(options: BetterAuthAdapterOptions): BetterAuthPort {
  const { auth, database } = options;
  return {
    async resolveSession(input) {
      if (input.cookieHeader === null || input.cookieHeader === "") return null;
      const headers = new Headers({ cookie: input.cookieHeader });
      if (input.requestOrigin !== null) headers.set("origin", input.requestOrigin);
      if (input.userAgent !== null) headers.set("user-agent", input.userAgent);
      const result = await auth.api.getSession({ headers });
      if (result === null || result === undefined) return null;
      const { session, user } = result;
      if (session.expiresAt.getTime() <= Date.now()) return null;

      const identity = await resolveIdentity(database, user.id);
      if (identity === null || identity.status !== "active") return null;

      const now = new Date();
      const positionIds = await withTenantTransaction(
        database,
        {
          tenantId: identity.tenant_id,
          userId: identity.user_id,
          positionId: NO_POSITION,
          requestId: session.id,
        },
        async (tx) => {
          const [tenant] = await tx
            .select({ status: tenants.status })
            .from(tenants)
            .where(eq(tenants.id, identity.tenant_id));
          if (tenant === undefined || tenant.status !== "active") return null;
          const rows = await tx
            .select({ id: positions.id })
            .from(userPositions)
            .innerJoin(
              positions,
              and(
                eq(positions.id, userPositions.positionId),
                eq(positions.tenantId, userPositions.tenantId),
              ),
            )
            .where(
              and(
                eq(userPositions.userId, identity.user_id),
                eq(userPositions.tenantId, identity.tenant_id),
                lte(userPositions.validFrom, now),
                or(isNull(userPositions.validTo), sql`${userPositions.validTo} > ${now}`),
              ),
            )
            .orderBy(asc(positions.key));
          return rows.map((row) => row.id);
        },
      );
      if (positionIds === null) return null;

      const value: AuthenticatedIdentity = {
        tenantId: identity.tenant_id,
        userId: identity.user_id,
        sessionId: session.id,
        positionIds,
        authenticatedAt: session.createdAt,
        sessionExpiresAt: session.expiresAt,
        authenticationMethods: ["password"],
      };
      return value;
    },
  };
}

/**
 * TODO(implementation): construct an OIDC authorization-code/PKCE provider port.
 * Input: one allowlisted issuer and secret references for its confidential client.
 * Output: an OidcProviderPort that verifies callbacks without issuing application sessions itself.
 * Errors: throws when discovery, algorithm policy, redirect URI, or client configuration is invalid.
 * Depends on: an OIDC client library, cached JWKS, and Better Auth integration.
 * Security: enforces state, nonce, PKCE, exact redirect matching, issuer/audience, and token expiry.
 */
export function createOidcAdapter(_options: OidcAdapterOptions): OidcProviderPort {
  throw new Error("TODO(implementation): createOidcAdapter");
}
