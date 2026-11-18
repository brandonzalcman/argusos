import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { createBetterAuth } from "../../src/auth/better-auth.js";
import { composeApi, createApiServer } from "../../src/composition.js";
import { type ApiConfig, parseApiEnvironment } from "../../src/config/env.js";
import type { DatabaseHandle } from "../../src/db/client.js";
import { withSystemTransaction } from "../../src/db/transaction.js";
import { users } from "../../src/persistence/system-schema.js";
import { assignPosition, createTestDatabase, createUser } from "./index.js";

export const TEST_WEB_ORIGIN = "http://localhost:3000";
/** Fictional credential used only by the test suite. */
export const TEST_PASSWORD = "test-password-not-secret-1";
const TEST_SECRET = "test-only-secret-test-only-secret-0123456789";

export interface TestApp {
  readonly app: FastifyInstance;
  readonly database: DatabaseHandle;
  readonly config: ApiConfig;
  close(): Promise<void>;
}

/** A fully migrated in-memory database behind a real Fastify server (Better Auth + tRPC). */
export async function createTestApp(): Promise<TestApp> {
  const database = await createTestDatabase();
  const environment = {
    NODE_ENV: "test",
    DATABASE_URL: "pglite:memory",
    BETTER_AUTH_SECRET: TEST_SECRET,
    PUBLIC_WEB_ORIGIN: TEST_WEB_ORIGIN,
    LOG_LEVEL: "error",
  };
  const config = parseApiEnvironment(environment);
  const app = await createApiServer(composeApi(config, environment, database));
  await app.ready();
  return {
    app,
    database,
    config,
    async close() {
      await app.close();
      await database.close();
    },
  };
}

/**
 * Create a Better Auth account (via a sign-up-enabled instance, as the dev seed does) and a linked
 * ArgusOS user in `tenantId`. Returns the ArgusOS user id and the login email.
 */
export async function createLoginUser(
  test: TestApp,
  tenantId: string,
  options: {
    displayName?: string;
    positionIds?: readonly string[];
    status?: "invited" | "active" | "disabled";
    validTo?: Date | null;
  } = {},
): Promise<{ userId: string; email: string; password: string }> {
  const email = `${randomUUID()}@example.invalid`;
  const signUp = createBetterAuth({
    database: test.database.db,
    secret: TEST_SECRET,
    baseURL: test.config.betterAuthUrl,
    trustedOrigins: [TEST_WEB_ORIGIN],
    allowSignUp: true,
  });
  const created = await signUp.api.signUpEmail({
    body: { email, password: TEST_PASSWORD, name: options.displayName ?? "Test User" },
  });
  const user = await createUser(test.database, tenantId, {
    displayName: options.displayName ?? "Test User",
    email,
    authUserId: created.user.id,
    status: options.status ?? "active",
  });
  for (const positionId of options.positionIds ?? []) {
    await assignPosition(test.database, {
      tenantId,
      userId: user.id,
      positionId,
      validTo: options.validTo ?? null,
    });
  }
  return { userId: user.id, email, password: TEST_PASSWORD };
}

export async function setUserStatus(
  test: TestApp,
  userId: string,
  status: "invited" | "active" | "disabled",
): Promise<void> {
  await withSystemTransaction(test.database.db, (tx) =>
    tx.update(users).set({ status }).where(eq(users.id, userId)),
  );
}

let addressCounter = 0;

/** Sign in through Better Auth's HTTP endpoint; returns the `Cookie` header value. */
export async function signIn(
  test: TestApp,
  credentials: { email: string; password: string },
): Promise<string> {
  addressCounter += 1;
  const response = await test.app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { origin: TEST_WEB_ORIGIN, "content-type": "application/json" },
    // Distinct client address per sign-in so Better Auth's per-IP rate limit does not couple tests.
    remoteAddress: `10.0.${Math.floor(addressCounter / 250)}.${(addressCounter % 250) + 1}`,
    payload: credentials,
  });
  if (response.statusCode !== 200) {
    throw new Error(`sign-in failed with status ${response.statusCode}`);
  }
  const setCookie = response.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie === undefined ? [] : [setCookie];
  const pairs = cookies.map((cookie) => cookie.split(";")[0] ?? "").filter((pair) => pair !== "");
  if (pairs.length === 0) throw new Error("sign-in returned no cookie");
  return pairs.join("; ");
}

export interface TrpcResult {
  readonly status: number;
  readonly data: unknown;
  readonly apiCode: string | null;
}

interface TrpcBody {
  result?: { data?: unknown };
  error?: { data?: { apiError?: { code?: string } } };
}

function toResult(status: number, text: string): TrpcResult {
  const body = JSON.parse(text) as TrpcBody;
  return {
    status,
    data: body.result?.data ?? null,
    apiCode: body.error?.data?.apiError?.code ?? null,
  };
}

export async function trpcQuery(
  test: TestApp,
  path: string,
  options: { cookie?: string; headers?: Record<string, string>; input?: unknown } = {},
): Promise<TrpcResult> {
  const query =
    options.input === undefined
      ? ""
      : `?input=${encodeURIComponent(JSON.stringify(options.input))}`;
  const response = await test.app.inject({
    method: "GET",
    url: `/trpc/${path}${query}`,
    headers: {
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...options.headers,
    },
  });
  return toResult(response.statusCode, response.body);
}

export async function trpcMutation(
  test: TestApp,
  path: string,
  input: unknown,
  options: { cookie?: string; headers?: Record<string, string> } = {},
): Promise<TrpcResult> {
  const response = await test.app.inject({
    method: "POST",
    url: `/trpc/${path}`,
    headers: {
      "content-type": "application/json",
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...options.headers,
    },
    payload: JSON.stringify(input),
  });
  return toResult(response.statusCode, response.body);
}
