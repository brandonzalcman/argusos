import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSystemTransaction } from "../src/db/transaction.js";
import {
  incidents,
  positions,
  tenants,
  userPositions,
  users,
} from "../src/persistence/system-schema.js";
import { runDevSeed } from "../src/scripts/seed-dev.js";
import { createTestApp, TEST_WEB_ORIGIN, type TestApp } from "./helpers/auth.js";
import { createTestDatabase } from "./helpers/index.js";

describe("API server", () => {
  let test: TestApp;

  beforeAll(async () => {
    test = await createTestApp();
  });

  afterAll(async () => {
    await test.close();
  });

  it("serves liveness and redacted readiness", async () => {
    const live = await test.app.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });

    const ready = await test.app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ok" });
    expect(ready.body).not.toMatch(/pglite|postgres|memory|secret/i);
  });

  it("keeps public sign-up closed", async () => {
    const response = await test.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_WEB_ORIGIN, "content-type": "application/json" },
      payload: {
        email: "intruder@example.invalid",
        password: "a-long-enough-password-1",
        name: "Intruder",
      },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.body).toMatch(/SIGN_UP_DISABLED|not enabled/i);
  });

  it("rejects app-API requests from origins outside the allowlist and allows the web origin via CORS", async () => {
    const denied = await test.app.inject({
      method: "GET",
      url: "/trpc/session.get",
      headers: { origin: "https://evil.example.invalid" },
    });
    expect(denied.statusCode).toBe(403);

    const preflight = await test.app.inject({
      method: "OPTIONS",
      url: "/trpc/session.get",
      headers: {
        origin: TEST_WEB_ORIGIN,
        "access-control-request-method": "GET",
      },
    });
    expect(preflight.headers["access-control-allow-origin"]).toBe(TEST_WEB_ORIGIN);
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("sets secure default headers", async () => {
    const response = await test.app.inject({ method: "GET", url: "/health/live" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("dev seed", () => {
  const baseEnvironment = {
    NODE_ENV: "development",
    DATABASE_URL: "pglite:memory",
    BETTER_AUTH_SECRET: "test-only-secret-test-only-secret-0123456789",
    ARGUS_ALLOW_DEV_SEED: "true",
    ARGUS_DEV_SEED_PASSWORD: "seed-test-password-not-secret",
  };

  it("refuses outside development, without the allow flag, or with a short password", async () => {
    const quiet = { log: () => undefined };
    await expect(runDevSeed({ ...baseEnvironment, NODE_ENV: "test" }, quiet)).rejects.toThrow(
      /NODE_ENV/,
    );
    await expect(
      runDevSeed({ ...baseEnvironment, ARGUS_ALLOW_DEV_SEED: "false" }, quiet),
    ).rejects.toThrow(/ARGUS_ALLOW_DEV_SEED/);
    await expect(
      runDevSeed({ ...baseEnvironment, ARGUS_DEV_SEED_PASSWORD: "short" }, quiet),
    ).rejects.toThrow(/ARGUS_DEV_SEED_PASSWORD/);
  });

  it("is idempotent and links every seeded user to a Better Auth account", async () => {
    const database = await createTestDatabase();
    try {
      const quiet = { log: () => undefined, database };
      await runDevSeed(baseEnvironment, quiet);
      await runDevSeed(baseEnvironment, quiet);
      const rows = await withSystemTransaction(database.db, async (tx) => ({
        tenants: await tx.select().from(tenants),
        users: await tx.select().from(users),
        positions: await tx.select().from(positions),
        incidents: await tx.select().from(incidents),
        assignments: await tx.select().from(userPositions),
      }));
      expect(rows.tenants).toHaveLength(1);
      expect(rows.users).toHaveLength(3);
      expect(rows.positions).toHaveLength(3);
      expect(rows.incidents).toHaveLength(1);
      expect(rows.assignments).toHaveLength(4);
      expect(rows.users.every((user) => user.authUserId !== null)).toBe(true);
      expect(rows.users.every((user) => user.email?.endsWith("@example.invalid"))).toBe(true);
    } finally {
      await database.close();
    }
  });
});
