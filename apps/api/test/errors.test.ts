import { randomUUID } from "node:crypto";
import { apiErrorSchema } from "@argus/schema";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiError } from "../src/errors.js";
import {
  authedProcedure,
  operationContextFrom,
  publicProcedure,
  router,
  type TrpcContext,
} from "../src/trpc/init.js";

const testRouter = router({
  secret: authedProcedure.query(({ ctx }) => ({ userId: ctx.context.userId })),
  conflict: publicProcedure.mutation(() => {
    throw apiError("definition-version-conflict", "The draft changed.", {
      details: { currentVersion: 3 },
    });
  }),
  boom: publicProcedure.query(() => {
    throw new Error("select * from meta.users -- password=hunter2");
  }),
  input: publicProcedure.input(z.strictObject({ name: z.string().min(3) })).query(() => "ok"),
});

const requestId = randomUUID();

async function call(path: string, context: TrpcContext["context"] = null, search = "") {
  const method = path === "conflict" ? "POST" : "GET";
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://test.local/trpc/${path}${search}`, {
      method,
      ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}),
    }),
    router: testRouter,
    createContext: () => ({
      requestId,
      correlationId: requestId,
      context,
      deps: { database: undefined as never },
    }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function apiErrorOf(body: Record<string, unknown>) {
  const error = body.error as { message: string; data: Record<string, unknown> };
  return { error, apiError: apiErrorSchema.parse(error.data.apiError) };
}

describe("API errors", () => {
  it("maps ApiError codes to HTTP status and exposes the ApiError with the request id", async () => {
    const { status, body } = await call("conflict");
    const { error, apiError: value } = apiErrorOf(body);
    expect(status).toBe(409);
    expect(value).toMatchObject({
      code: "definition-version-conflict",
      requestId,
      retryable: false,
      details: { currentVersion: 3 },
    });
    expect(error.data.stack).toBeUndefined();
  });

  it("returns unauthenticated for anonymous callers of authedProcedure", async () => {
    const { status, body } = await call("secret");
    expect(status).toBe(401);
    expect(apiErrorOf(body).apiError.code).toBe("unauthenticated");
  });

  it("hides internal error details (no SQL, secrets or stack)", async () => {
    const { status, body } = await call("boom");
    const { error, apiError: value } = apiErrorOf(body);
    expect(status).toBe(500);
    expect(value.code).toBe("internal");
    expect(JSON.stringify(body)).not.toMatch(/select \*|hunter2|at .*\.ts/);
    expect(error.message).toBe(value.message);
  });

  it("maps input validation failures to validation-failed with field errors", async () => {
    const { status, body } = await call(
      "input",
      null,
      `?input=${encodeURIComponent(JSON.stringify({ name: "x" }))}`,
    );
    const { apiError: value } = apiErrorOf(body);
    expect(status).toBe(400);
    expect(value.code).toBe("validation-failed");
    expect(Object.keys(value.fieldErrors)).toContain("name");
  });
});

describe("operationContextFrom", () => {
  it("derives the OperationContext from the verified request context only", () => {
    const authenticatedAt = new Date("2026-11-19T10:00:00.000Z");
    const ids = { tenantId: randomUUID(), userId: randomUUID(), positionId: randomUUID() };
    expect(
      operationContextFrom({
        requestId,
        correlationId: requestId,
        authKind: "session",
        ...ids,
        activeIncidentId: null,
        sessionId: "session-1",
        apiKeyId: null,
        grantedCapabilities: [],
        authenticatedAt,
        sessionExpiresAt: null,
      }),
    ).toEqual({
      ...ids,
      incidentId: null,
      requestId,
      authenticatedAt: authenticatedAt.toISOString(),
    });
  });
});
