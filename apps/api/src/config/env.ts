export interface ApiConfig {
  readonly environment: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly publicOrigin: string;
  readonly databaseUrlSecretRef: string;
  readonly betterAuthSecretRef: string;
  readonly oidcIssuerUrl: string | null;
  readonly oidcClientId: string | null;
  readonly oidcClientSecretRef: string | null;
  readonly s3Endpoint: string;
  readonly s3Bucket: string;
  readonly s3CredentialsSecretRef: string;
  readonly trustedProxyHops: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * TODO(implementation): validate and normalize API environment variables without logging secret values.
 * Input: raw environment values from the process or a test harness.
 * Output: an immutable API configuration containing secret references, never resolved secrets.
 * Errors: throws a redacted configuration error listing missing or invalid variables.
 * Depends on: Zod, deployment secret-reference conventions, and Better Auth/OIDC settings.
 * Security: production must require secure origins, explicit proxy trust, and distinct least-privilege credentials.
 */
export function parseApiEnvironment(
  _environment: Readonly<Record<string, string | undefined>>,
): ApiConfig {
  throw new Error("TODO(implementation): parseApiEnvironment");
}
