import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import {
  type RequestContext,
  requestIdentifiers,
  requireIncidentContext,
  resolveRequestContext,
  tryResolveRequestContext,
} from "../src/http/request-context.js";

function fakeRequest(headers: Record<string, string>, id = crypto.randomUUID()): FastifyRequest {
  return { id, headers, ip: "127.0.0.1" } as unknown as FastifyRequest;
}

const anonymousPorts = {
  betterAuth: { resolveSession: async () => null },
  database: {} as never,
};

function contextWith(activeIncidentId: string | null): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    authKind: "session",
    tenantId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    positionId: crypto.randomUUID(),
    activeIncidentId,
    sessionId: "session",
    apiKeyId: null,
    grantedCapabilities: [],
    authenticatedAt: new Date(),
    sessionExpiresAt: new Date(Date.now() + 60_000),
  };
}

describe("API request authentication", () => {
  // Tenant/position derivation, spoofing, disabled users, expired assignments, incident
  // revalidation and audit attribution are exercised end to end in session.test.ts.

  it("resolves no context without a verified session and throws 401 from the strict variant", async () => {
    const request = fakeRequest({ cookie: "argus.session_token=forged" });
    expect(await tryResolveRequestContext(request, anonymousPorts)).toBeNull();
    await expect(resolveRequestContext(request, anonymousPorts)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("uses a UUID correlation id from the client and otherwise the request id", () => {
    const requestId = crypto.randomUUID();
    const supplied = crypto.randomUUID();
    expect(requestIdentifiers(fakeRequest({ "x-correlation-id": supplied }, requestId))).toEqual({
      requestId,
      correlationId: supplied,
    });
    expect(
      requestIdentifiers(fakeRequest({ "x-correlation-id": "not a uuid; drop table" }, requestId)),
    ).toEqual({ requestId, correlationId: requestId });
  });

  it("requires an explicitly selected incident for incident-scoped operations", () => {
    expect(() => requireIncidentContext(contextWith(null))).toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
    expect(() => requireIncidentContext(contextWith(crypto.randomUUID()))).not.toThrow();
  });

  it.todo("rejects scoped API-key credentials that lack the capability for the operation");
  it.todo("requires MFA and session policy for privileged administration operations");
});
