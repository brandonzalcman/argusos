export interface AuthenticatedIdentity {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly positionIds: readonly string[];
  readonly authenticatedAt: Date;
  readonly sessionExpiresAt: Date;
  readonly authenticationMethods: readonly ("password" | "oidc" | "passkey" | "mfa")[];
}

export interface BetterAuthSessionInput {
  readonly cookieHeader: string | null;
  readonly requestOrigin: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface OidcCallbackInput {
  readonly issuer: string;
  readonly callbackUrl: string;
  readonly code: string;
  readonly state: string;
  readonly pkceVerifier: string;
  readonly expectedNonce: string;
}

export interface OidcIdentityClaims {
  readonly subject: string;
  readonly issuer: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly groups: readonly string[];
  readonly authTime: Date;
}

/** Port implemented by the Better Auth adapter; implementations must not trust unverified cookies. */
export interface BetterAuthPort {
  /**
   * Resolve a server-verified session for an incoming request.
   * Input: bounded cookie and request metadata needed for session binding and audit.
   * Output: the authenticated identity, or null when no valid active session exists.
   * Errors: throws only for unavailable or malformed identity infrastructure, not ordinary anonymous requests.
   * Depends on: Better Auth session storage and ArgusOS tenant/user/position mappings.
   * Security: checks revocation, expiry, MFA policy, session limits, and tenant membership.
   */
  resolveSession(input: BetterAuthSessionInput): Promise<AuthenticatedIdentity | null>;
}

/** Port for standards-based OIDC federation; local session issuance remains Better Auth's responsibility. */
export interface OidcProviderPort {
  /**
   * Validate an authorization-code callback and its OIDC tokens.
   * Input: the exact callback, one-time state, PKCE verifier, and expected nonce.
   * Output: verified claims without creating an ArgusOS session.
   * Errors: throws a redacted federation error for invalid state, nonce, signature, issuer, audience, or expiry.
   * Depends on: issuer discovery/JWKS, an allowlisted issuer configuration, and Better Auth callback flow.
   * Security: never logs codes/tokens and must prevent callback replay and account-linking confusion.
   */
  validateCallback(input: OidcCallbackInput): Promise<OidcIdentityClaims>;
}
