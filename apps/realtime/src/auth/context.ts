import type { IncomingMessage } from "node:http";

export interface ConnectionAuthContext {
  readonly connectionId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string;
  readonly activeIncidentId: string | null;
  readonly sessionId: string | null;
  readonly apiKeyId: string | null;
  readonly grantedCapabilities: readonly string[];
  readonly tokenExpiresAt: Date;
  readonly authenticatedAt: Date;
}

export interface ConnectionAuthenticator {
  /**
   * Authenticate a WebSocket upgrade before any application frame is accepted.
   * Input: bounded HTTP upgrade metadata, secure cookies/token, and server-derived connection ID.
   * Output: server-verified tenant/user/position/incident scope and token expiry.
   * Errors: throws a mapped 401/403 close error without disclosing credential or membership details.
   * Depends on: API session/API-key introspection and current position/incident membership.
   * Security: ignores spoofed identity headers and records an audited connection event.
   */
  authenticateUpgrade(
    request: IncomingMessage,
    connectionId: string,
  ): Promise<ConnectionAuthContext>;

  /**
   * Revalidate an existing connection after token refresh or membership change.
   * Input: current verified context and a newly presented credential where applicable.
   * Output: refreshed context, or rejection that triggers an authenticated close.
   * Errors: throws on revoked/expired session, position, incident, or API-key access.
   * Depends on: the same API introspection used at upgrade and a monotonic authorization revision.
   */
  revalidate(
    context: ConnectionAuthContext,
    credential: string | null,
  ): Promise<ConnectionAuthContext>;
}

/**
 * TODO(implementation): create the API-backed connection authenticator.
 * Input: internal API origin and service authentication material supplied by composition.
 * Output: a ConnectionAuthenticator shared by upgrade and refresh lifecycle paths.
 * Errors: throws for insecure internal origin or unavailable authentication configuration.
 * Depends on: bounded HTTP client, API introspection contract, and redacted telemetry.
 * Security: tokens are compared/validated server-side and never included in logs or error frames.
 */
export function createConnectionAuthenticator(
  _apiInternalOrigin: string,
  _serviceCredentialSecretRef: string,
): ConnectionAuthenticator {
  throw new Error("TODO(implementation): createConnectionAuthenticator");
}
