import { z } from "zod";

export type DatabaseKind = "postgres" | "pglite";

export interface ApiConfig {
  readonly environment: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  /** Public origin of this API (used for absolute URLs). */
  readonly publicOrigin: string;
  /** Allowlisted browser origins for CORS and Better Auth trusted origins. */
  readonly webOrigins: readonly string[];
  /** Base URL Better Auth uses to build callbacks and cookies. */
  readonly betterAuthUrl: string;
  /** `env:NAME` reference to the database URL; resolve with {@link resolveDatabaseUrl}. */
  readonly databaseUrlSecretRef: string;
  /** Which driver the database URL selects. Production never allows `pglite`. */
  readonly databaseKind: DatabaseKind;
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

type Environment = Readonly<Record<string, string | undefined>>;

/** Redacted configuration error: lists variable names and generic reasons, never values. */
export class ApiConfigurationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid API configuration: ${problems.join("; ")}`);
    this.name = "ApiConfigurationError";
    this.problems = problems;
  }
}

const SECRET_REF_PATTERN = /^env:([A-Za-z_][A-Za-z0-9_]*)$/;

/**
 * Resolve a secret reference to its value. Only `env:NAME` references are supported today.
 * Errors: throws without echoing the value; unsupported schemes throw a TODO(implementation) error.
 */
export function resolveSecretRef(ref: string, environment: Environment): string {
  const match = SECRET_REF_PATTERN.exec(ref);
  if (match === null) {
    // Never echo the ref beyond its scheme: a mistyped literal secret must not reach logs.
    const scheme = ref.includes(":") ? ref.slice(0, ref.indexOf(":")) : "(none)";
    throw new Error(
      `TODO(implementation): secret reference scheme "${scheme}" is not supported; only env:NAME is`,
    );
  }
  const name = match[1] as string;
  const value = environment[name];
  if (value === undefined || value === "") {
    throw new Error(`Secret reference points to an unset environment variable: ${name}`);
  }
  return value;
}

/** Resolve the configured database URL (a secret: it may embed credentials). Do not log it. */
export function resolveDatabaseUrl(config: ApiConfig, environment: Environment): string {
  return resolveSecretRef(config.databaseUrlSecretRef, environment);
}

function databaseKindOf(url: string): DatabaseKind | null {
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return "postgres";
  if (url === "pglite:memory" || (url.startsWith("pglite:") && url.length > "pglite:".length)) {
    return "pglite";
  }
  return null;
}

const rawSchema = z.object({
  // Fail closed: no default, so a missing NODE_ENV can never silently select development behaviour.
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_HOST: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  PUBLIC_API_URL: z.string().optional(),
  PUBLIC_WEB_ORIGIN: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Empty strings are treated as unset so `.env` files with blank values behave as defaults. */
function blankToUndefined(environment: Environment): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(environment)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

/**
 * Validate and normalize API environment variables without logging secret values.
 * Input: raw environment values from the process or a test harness.
 * Output: an immutable API configuration containing secret references, never resolved secrets.
 * Errors: throws {@link ApiConfigurationError} listing variable names only.
 * Security: production rejects `pglite:` URLs, non-https origins and short auth secrets.
 */
export function parseApiEnvironment(environment: Environment): ApiConfig {
  const problems: string[] = [];
  const parsed = rawSchema.safeParse(blankToUndefined(environment));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = issue.path.join(".") || "environment";
      problems.push(
        name === "NODE_ENV"
          ? "NODE_ENV is required and must be development, test or production"
          : `${name} is invalid`,
      );
    }
    throw new ApiConfigurationError(problems);
  }
  const env = parsed.data;
  const nodeEnv = env.NODE_ENV;
  const production = nodeEnv === "production";

  const port = env.API_PORT ?? 3001;
  const host = env.API_HOST ?? (production ? "0.0.0.0" : "127.0.0.1");

  // Database: DATABASE_URL may be the URL itself or an `env:NAME` indirection.
  let databaseUrlSecretRef = "env:DATABASE_URL";
  let databaseKind: DatabaseKind = "postgres";
  const databaseValue = env.DATABASE_URL;
  if (databaseValue === undefined) {
    problems.push("DATABASE_URL is required");
  } else {
    if (SECRET_REF_PATTERN.test(databaseValue)) databaseUrlSecretRef = databaseValue;
    try {
      const resolved = resolveSecretRef(databaseUrlSecretRef, environment);
      const kind = databaseKindOf(resolved);
      if (kind === null) {
        problems.push("DATABASE_URL must be postgresql://, pglite:<dir> or pglite:memory");
      } else {
        databaseKind = kind;
        if (production && kind === "pglite") {
          problems.push("DATABASE_URL must not use pglite: in production");
        }
      }
    } catch {
      problems.push("DATABASE_URL reference is unresolved");
    }
  }

  // Better Auth secret.
  const betterAuthSecretRef = "env:BETTER_AUTH_SECRET";
  if (env.BETTER_AUTH_SECRET === undefined) {
    problems.push("BETTER_AUTH_SECRET is required");
  } else if (production && env.BETTER_AUTH_SECRET.length < 32) {
    problems.push("BETTER_AUTH_SECRET must be at least 32 characters in production");
  }

  // Origins.
  const rawWebOrigins = (env.PUBLIC_WEB_ORIGIN ?? (production ? "" : "http://localhost:3000"))
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const webOrigins: string[] = [];
  if (rawWebOrigins.length === 0) problems.push("PUBLIC_WEB_ORIGIN is required in production");
  for (const raw of rawWebOrigins) {
    const origin = parseOrigin(raw);
    if (origin === null) {
      problems.push("PUBLIC_WEB_ORIGIN contains an invalid origin");
    } else if (production && !origin.startsWith("https://")) {
      problems.push("PUBLIC_WEB_ORIGIN must use https in production");
    } else if (!webOrigins.includes(origin)) {
      webOrigins.push(origin);
    }
  }

  const publicOriginRaw = env.PUBLIC_API_URL ?? (production ? "" : `http://localhost:${port}`);
  const publicOrigin = publicOriginRaw === "" ? null : parseOrigin(publicOriginRaw);
  if (publicOrigin === null) {
    problems.push("PUBLIC_API_URL is required and must be an http(s) origin");
  } else if (production && !publicOrigin.startsWith("https://")) {
    problems.push("PUBLIC_API_URL must use https in production");
  }

  const betterAuthUrlRaw = env.BETTER_AUTH_URL ?? publicOrigin ?? "";
  const betterAuthUrl = betterAuthUrlRaw === "" ? null : parseOrigin(betterAuthUrlRaw);
  if (betterAuthUrl === null) {
    problems.push("BETTER_AUTH_URL must be an http(s) origin");
  } else if (production && !betterAuthUrl.startsWith("https://")) {
    problems.push("BETTER_AUTH_URL must use https in production");
  }

  // Optional OIDC (stub elsewhere): all-or-nothing.
  const oidcSet = [env.OIDC_ISSUER_URL, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET].filter(
    (value) => value !== undefined,
  ).length;
  if (oidcSet !== 0 && oidcSet !== 3) {
    problems.push("OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set together");
  }

  // Object storage is not used in this slice; required only in production.
  if (production && (env.S3_ENDPOINT === undefined || env.S3_BUCKET === undefined)) {
    problems.push("S3_ENDPOINT and S3_BUCKET are required in production");
  }

  if (production && env.TRUSTED_PROXY_HOPS === undefined) {
    problems.push("TRUSTED_PROXY_HOPS must be set explicitly in production");
  }

  if (problems.length > 0) throw new ApiConfigurationError(problems);

  return Object.freeze({
    environment: nodeEnv,
    host,
    port,
    publicOrigin: publicOrigin as string,
    webOrigins: Object.freeze(webOrigins),
    betterAuthUrl: betterAuthUrl as string,
    databaseUrlSecretRef,
    databaseKind,
    betterAuthSecretRef,
    oidcIssuerUrl: env.OIDC_ISSUER_URL ?? null,
    oidcClientId: env.OIDC_CLIENT_ID ?? null,
    oidcClientSecretRef: env.OIDC_CLIENT_SECRET === undefined ? null : "env:OIDC_CLIENT_SECRET",
    s3Endpoint: env.S3_ENDPOINT ?? "http://localhost:9000",
    s3Bucket: env.S3_BUCKET ?? "argus-local",
    s3CredentialsSecretRef: "env:S3_SECRET_ACCESS_KEY",
    trustedProxyHops: env.TRUSTED_PROXY_HOPS ?? 0,
    logLevel: env.LOG_LEVEL ?? (production ? "info" : "debug"),
  });
}
