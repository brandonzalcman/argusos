import { describe, expect, it } from "vitest";
import {
  ApiConfigurationError,
  parseApiEnvironment,
  resolveDatabaseUrl,
  resolveSecretRef,
} from "../src/config/env.js";

const secret = "s3cr3t-value-that-is-definitely-longer-than-32-chars";
const devEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "pglite:memory",
  BETTER_AUTH_SECRET: "dev-secret",
};
const prodEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://argus:p4ssw0rd-value@db.internal:5432/argus",
  BETTER_AUTH_SECRET: secret,
  PUBLIC_API_URL: "https://api.example.test",
  PUBLIC_WEB_ORIGIN: "https://app.example.test",
  S3_ENDPOINT: "https://s3.example.test",
  S3_BUCKET: "argus",
  TRUSTED_PROXY_HOPS: "1",
};

function problemsOf(environment: Record<string, string | undefined>): string {
  try {
    parseApiEnvironment(environment);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiConfigurationError);
    return (error as ApiConfigurationError).message;
  }
  throw new Error("expected parseApiEnvironment to throw");
}

describe("parseApiEnvironment", () => {
  it("applies development defaults and keeps secrets as references", () => {
    const config = parseApiEnvironment(devEnv);
    expect(config.environment).toBe("development");
    expect(config.databaseKind).toBe("pglite");
    expect(config.databaseUrlSecretRef).toBe("env:DATABASE_URL");
    expect(config.betterAuthSecretRef).toBe("env:BETTER_AUTH_SECRET");
    expect(config.webOrigins).toEqual(["http://localhost:3000"]);
    expect(JSON.stringify(config)).not.toContain("dev-secret");
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("accepts a production configuration", () => {
    const config = parseApiEnvironment(prodEnv);
    expect(config.databaseKind).toBe("postgres");
    expect(config.webOrigins).toEqual(["https://app.example.test"]);
    expect(JSON.stringify(config)).not.toContain("p4ssw0rd-value");
    expect(resolveDatabaseUrl(config, prodEnv)).toBe(prodEnv.DATABASE_URL);
  });

  it("rejects pglite, plain-http origins and short auth secrets in production, without echoing values", () => {
    const message = problemsOf({
      ...prodEnv,
      DATABASE_URL: "pglite:/var/lib/argus-data",
      PUBLIC_WEB_ORIGIN: "http://app.example.test",
      BETTER_AUTH_SECRET: "too-short-secret-value",
    });
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("PUBLIC_WEB_ORIGIN");
    expect(message).toContain("BETTER_AUTH_SECRET");
    expect(message).not.toContain("too-short-secret-value");
    expect(message).not.toContain("/var/lib/argus-data");
  });

  it("fails closed when NODE_ENV is missing, blank or unknown", () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = devEnv;
    expect(problemsOf(withoutNodeEnv)).toContain("NODE_ENV is required");
    expect(problemsOf({ ...devEnv, NODE_ENV: "staging" })).toContain("NODE_ENV is required");
    expect(problemsOf({ ...devEnv, NODE_ENV: "" })).toContain("NODE_ENV is required");
  });

  it("requires DATABASE_URL and BETTER_AUTH_SECRET and a valid scheme", () => {
    expect(problemsOf({ NODE_ENV: "development" })).toMatch(
      /DATABASE_URL is required.*BETTER_AUTH_SECRET is required/,
    );
    expect(problemsOf({ ...devEnv, DATABASE_URL: "mysql://nope" })).toContain(
      "DATABASE_URL must be",
    );
  });

  it("supports an env: indirection for the database URL", () => {
    const environment = { ...devEnv, DATABASE_URL: "env:ARGUS_DB", ARGUS_DB: "pglite:memory" };
    const config = parseApiEnvironment(environment);
    expect(config.databaseUrlSecretRef).toBe("env:ARGUS_DB");
    expect(resolveDatabaseUrl(config, environment)).toBe("pglite:memory");
  });
});

describe("resolveSecretRef", () => {
  it("resolves env: references and fails closed otherwise", () => {
    expect(resolveSecretRef("env:X", { X: "value" })).toBe("value");
    expect(() => resolveSecretRef("env:MISSING", {})).toThrow(/MISSING/);
    expect(() => resolveSecretRef("vault:path/to/secret", {})).toThrow(/TODO\(implementation\)/);
    try {
      resolveSecretRef("literal-secret-value", {});
    } catch (error) {
      expect(String(error)).not.toContain("literal-secret-value");
    }
  });
});
