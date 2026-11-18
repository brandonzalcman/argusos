import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/client.js";
import { authSchemaTables } from "../persistence/system-schema.js";

export interface BetterAuthOptions {
  /** System (owner) connection: `argus_app` has no access to the `auth` schema. */
  readonly database: Database;
  /** Resolved secret used to sign cookies and hash tokens. Never log it. */
  readonly secret: string;
  /** Public API origin; cookies become `Secure` when it is https. */
  readonly baseURL: string;
  /** Browser origins allowed to call the auth endpoints (CSRF/origin check). */
  readonly trustedOrigins: readonly string[];
  /**
   * Public sign-up is ALWAYS closed on the served instance (`false`, the default). Only the explicit
   * dev seed script builds a second, process-local instance with `true`, because Better Auth also
   * blocks server-side `auth.api.signUpEmail` when `disableSignUp` is set.
   */
  readonly allowSignUp?: boolean;
}

/** Cookie name prefix; the session cookie is `argus.session_token` (`__Secure-` prefixed on https). */
export const AUTH_COOKIE_PREFIX = "argus";

/** Minimum password length enforced by Better Auth for any account it creates. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Build the Better Auth instance: email + password, Drizzle adapter on the `auth` schema, HttpOnly
 * SameSite=Lax cookies, built-in rate limiting. Tenant and position membership are NOT stored here;
 * they are mapped through `meta.users.auth_user_id` on the server.
 */
export function createBetterAuth(options: BetterAuthOptions) {
  const secure = options.baseURL.startsWith("https://");
  const allowSignUp = options.allowSignUp === true;
  return betterAuth({
    appName: "ArgusOS",
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [...options.trustedOrigins],
    database: drizzleAdapter(options.database, {
      provider: "pg",
      schema: authSchemaTables,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      autoSignIn: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    rateLimit: { enabled: true, storage: "memory" },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure },
      // The HTTP layer overwrites x-forwarded-for with Fastify's trust-proxy-aware client address.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    logger: { level: "warn" },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
