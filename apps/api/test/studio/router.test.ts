import { randomUUID } from "node:crypto";
import type { StudioDocument } from "@argus/schema";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "../../src/db/client.js";
import type { ApiRequestError } from "../../src/errors.js";
import type { RequestContext } from "../../src/http/request-context.js";
import { createStudioRouter } from "../../src/studio/router.js";
import type { TrpcContext } from "../../src/trpc/init.js";
import { createTestDatabase } from "../helpers/index.js";
import { type Actor, createInput, createTenantActor, idemKey } from "./support.js";

function requestContextOf(actor: Actor): RequestContext {
  return {
    requestId: randomUUID(),
    correlationId: randomUUID(),
    authKind: "session",
    tenantId: actor.tenantId,
    userId: actor.userId,
    positionId: actor.positionId,
    activeIncidentId: null,
    sessionId: null,
    apiKeyId: null,
    grantedCapabilities: [],
    authenticatedAt: new Date(),
    sessionExpiresAt: null,
  };
}

describe("studio router", () => {
  let database: DatabaseHandle;
  let actor: Actor;
  let router: ReturnType<typeof createStudioRouter>;

  const callerFor = (who: Actor | null) => {
    const context: TrpcContext = {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      context: who === null ? null : requestContextOf(who),
      deps: { database: database.db },
    };
    return router.createCaller(context);
  };

  beforeAll(async () => {
    database = await createTestDatabase();
    router = createStudioRouter({ database: database.db });
    actor = await createTenantActor(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("runs create -> get -> saveDraft -> publish -> list through tRPC callers", async () => {
    const caller = callerFor(actor);
    const created = await caller.create(createInput({ kind: "page" }));
    const draft = await caller.get({ kind: "page", id: created.id, revision: "draft" });
    expect(draft?.version).toBe(1);
    if (draft === null) throw new Error("draft expected");
    const saved = await caller.saveDraft({
      id: created.id,
      baseVersion: 1,
      document: draft.document,
    });
    const published = await caller.publish({
      kind: "page",
      id: created.id,
      expectedVersion: saved.version,
      changeSummary: "via router",
      idempotencyKey: idemKey(),
    });
    expect(published.version).toBe(saved.version);
    const listed = await caller.list({ kind: "page", search: null, cursor: null, limit: 50 });
    expect(listed.items.find((item) => item.id === created.id)?.publishedVersion).toBe(
      published.version,
    );
    expect(await caller.listVersions({ kind: "page", id: created.id })).toHaveLength(1);
  });

  it("requires authentication", async () => {
    const error = await callerFor(null)
      .list({ kind: "page", search: null, cursor: null, limit: 5 })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed input with a bad-request error", async () => {
    const error = await callerFor(actor)
      .list({ kind: "nope", search: null, cursor: null, limit: 5 } as never)
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
  });

  it("surfaces version conflicts with the apiError code", async () => {
    const caller = callerFor(actor);
    const created = await caller.create(createInput({ kind: "page" }));
    const draft = await caller.get({ kind: "page", id: created.id, revision: "draft" });
    if (draft === null) throw new Error("draft expected");
    const error = await caller
      .saveDraft({ id: created.id, baseVersion: 7, document: draft.document })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("CONFLICT");
    expect(((error as TRPCError).cause as ApiRequestError).code).toBe(
      "definition-version-conflict",
    );
  });

  describe("validate", () => {
    it("returns issues for a schema-invalid document instead of rejecting the request", async () => {
      const result = await callerFor(actor).validate({
        document: { kind: "board", bundle: {} } as unknown as StudioDocument,
      });
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
    });

    it("rejects an envelope that is not exactly { document }", async () => {
      const caller = callerFor(actor);
      for (const bad of [null, [], { doc: 1 }, { document: {}, extra: 1 }, "x"]) {
        const error = await caller.validate(bad as never).then(
          () => null,
          (caught: unknown) => caught,
        );
        expect(error, JSON.stringify(bad)).toBeInstanceOf(TRPCError);
        // tRPC wraps parser failures; the error formatter maps BAD_REQUEST to validation-failed.
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });
  });
});
