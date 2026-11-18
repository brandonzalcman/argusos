import type { BetterAuthPort, OidcProviderPort } from "./ports.js";

export interface BetterAuthAdapterOptions {
  readonly databaseUrlSecretRef: string;
  readonly secretRef: string;
  readonly publicOrigin: string;
  readonly trustedProxyHops: number;
}

export interface OidcAdapterOptions {
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly clientSecretRef: string;
  readonly publicOrigin: string;
}

/**
 * TODO(implementation): construct the Better Auth session port with ArgusOS identity mappings.
 * Input: non-secret configuration plus references resolved by the deployment secret provider.
 * Output: a BetterAuthPort used by request authentication.
 * Errors: throws for unsafe production settings or unavailable identity initialization.
 * Depends on: Better Auth, Drizzle system identity tables, and secure cookie configuration.
 * Security: tenant and position membership must come from server-side mappings, not client claims.
 */
export function createBetterAuthAdapter(_options: BetterAuthAdapterOptions): BetterAuthPort {
  throw new Error("TODO(implementation): createBetterAuthAdapter");
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
