import { randomUUID } from "node:crypto";
import type { BlockDefinition, StudioDocument } from "@argus/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serializeRequestForLog } from "../../src/composition.js";
import type { DatabaseHandle } from "../../src/db/client.js";
import { encodeCursor } from "../../src/studio/mapping.js";
import { createStudioService, type StudioService } from "../../src/studio/service.js";
import {
  createLoginUser,
  createTestApp,
  signIn,
  type TestApp,
  trpcMutation,
  trpcQuery,
} from "../helpers/auth.js";
import { createPosition, createTenant, createTestDatabase } from "../helpers/index.js";
import {
  type Actor,
  auditRowsFor,
  createAndGet,
  createAndPublish,
  createTenantActor,
  expectApiError,
  idemKey,
  seedPublishedBoard,
} from "./support.js";

function block(type: BlockDefinition["type"], config: BlockDefinition["config"]): BlockDefinition {
  return {
    id: randomUUID(),
    type,
    name: `${type} block`,
    config,
    visibilityExpression: null,
    action: null,
    access: { positionIds: [], visibilityRule: null },
  };
}

type PageDraft = Awaited<ReturnType<typeof createAndGet>>["draft"];

function pageWithBlocks(draft: PageDraft, blocks: BlockDefinition[]): StudioDocument {
  if (draft.document.kind !== "page") throw new Error("expected page");
  return {
    kind: "page",
    definition: {
      ...draft.document.definition,
      blocks,
      layouts: [
        {
          breakpoint: "desktop",
          items: blocks.map((b, index) => ({
            blockId: b.id,
            x: 0,
            y: index * 4,
            width: 6,
            height: 4,
            hidden: false,
          })),
        },
      ],
    },
  };
}

function pageClaiming(draft: PageDraft, positionIds: string[]): StudioDocument {
  if (draft.document.kind !== "page") throw new Error("expected page");
  return {
    kind: "page",
    definition: { ...draft.document.definition, homepageForPositionIds: positionIds },
  };
}

describe("studio review fixes", () => {
  let database: DatabaseHandle;
  let service: StudioService;
  let actor: Actor;

  beforeAll(async () => {
    database = await createTestDatabase();
    service = createStudioService({ database: database.db });
    actor = await createTenantActor(database);
  });

  afterAll(async () => {
    await database.close();
  });

  const publishAs = (who: Actor, kind: "page" | "component", id: string, expectedVersion: number) =>
    service.publish(who.context(), {
      kind,
      id,
      expectedVersion,
      changeSummary: "publish",
      idempotencyKey: idemKey(),
    });

  describe("homepage claims", () => {
    it("lets exactly one of two concurrent publishes claim the same homepage position", async () => {
      const claimant = await createTenantActor(database);
      const a = await createAndGet(service, claimant, { kind: "page" });
      const b = await createAndGet(service, claimant, { kind: "page" });
      const savedA = await service.saveDraft(claimant.context(), {
        id: a.created.id,
        baseVersion: 1,
        document: pageClaiming(a.draft, [claimant.positionId]),
      });
      const savedB = await service.saveDraft(claimant.context(), {
        id: b.created.id,
        baseVersion: 1,
        document: pageClaiming(b.draft, [claimant.positionId]),
      });
      const results = await Promise.allSettled([
        publishAs(claimant, "page", a.created.id, savedA.version),
        publishAs(claimant, "page", b.created.id, savedB.version),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    });

    it("rejects a rollback that would restore a homepage claimed by another page since", async () => {
      const claimant = await createTenantActor(database);
      const first = await createAndGet(service, claimant, { kind: "page" });
      const v1 = await service.saveDraft(claimant.context(), {
        id: first.created.id,
        baseVersion: 1,
        document: pageClaiming(first.draft, [claimant.positionId]),
      });
      await publishAs(claimant, "page", first.created.id, v1.version);
      // Version 2 drops the claim.
      const current = await service.get(claimant.context(), {
        kind: "page",
        id: first.created.id,
        revision: "published",
      });
      if (current === null) throw new Error("expected page");
      const v2 = await service.saveDraft(claimant.context(), {
        id: first.created.id,
        baseVersion: v1.version,
        document: pageClaiming(current, []),
      });
      await publishAs(claimant, "page", first.created.id, v2.version);
      // Another page takes the position.
      const second = await createAndGet(service, claimant, { kind: "page" });
      const s1 = await service.saveDraft(claimant.context(), {
        id: second.created.id,
        baseVersion: 1,
        document: pageClaiming(second.draft, [claimant.positionId]),
      });
      await publishAs(claimant, "page", second.created.id, s1.version);

      const error = await expectApiError(
        service.rollback(claimant.context(), {
          kind: "page",
          id: first.created.id,
          expectedPublishedVersion: v2.version,
          restoreVersion: v1.version,
          changeSummary: "restore claim",
          idempotencyKey: idemKey(),
        }),
        "validation-failed",
      );
      expect(
        Object.keys(error.fieldErrors).some((key) => key.includes("homepageForPositionIds")),
      ).toBe(true);
      expect(error.details?.issues).toBeInstanceOf(Array);
    });

    it("rejects a rollback whose restored version references a board that is no longer published", async () => {
      const board = await seedPublishedBoard(database, actor);
      const page = await createAndGet(service, actor, { kind: "page" });
      const withEmbed = await service.saveDraft(actor.context(), {
        id: page.created.id,
        baseVersion: 1,
        document: pageWithBlocks(page.draft, [
          block("board-embed", { boardId: board.id, showHeader: true }),
        ]),
      });
      await publishAs(actor, "page", page.created.id, withEmbed.version);
      const published = await service.get(actor.context(), {
        kind: "page",
        id: page.created.id,
        revision: "published",
      });
      if (published === null) throw new Error("expected page");
      const plain = await service.saveDraft(actor.context(), {
        id: page.created.id,
        baseVersion: withEmbed.version,
        document: pageWithBlocks(published, []),
      });
      await publishAs(actor, "page", page.created.id, plain.version);
      // No published page references the board any more, so it can be archived.
      await service.archive(actor.context(), {
        kind: "board",
        id: board.id,
        expectedVersion: 1,
        idempotencyKey: idemKey(),
      });
      await expectApiError(
        service.rollback(actor.context(), {
          kind: "page",
          id: page.created.id,
          expectedPublishedVersion: plain.version,
          restoreVersion: withEmbed.version,
          changeSummary: "restore embed",
          idempotencyKey: idemKey(),
        }),
        "validation-failed",
      );
    });
  });

  describe("archive with dependents", () => {
    it("blocks archiving a board embedded by a published page, then allows it once the page is archived", async () => {
      const board = await seedPublishedBoard(database, actor);
      const page = await createAndGet(service, actor, { kind: "page" });
      const saved = await service.saveDraft(actor.context(), {
        id: page.created.id,
        baseVersion: 1,
        document: pageWithBlocks(page.draft, [
          block("board-embed", { boardId: board.id, showHeader: true }),
        ]),
      });
      await publishAs(actor, "page", page.created.id, saved.version);

      const error = await expectApiError(
        service.archive(actor.context(), {
          kind: "board",
          id: board.id,
          expectedVersion: 1,
          idempotencyKey: idemKey(),
        }),
        "dependency-conflict",
      );
      expect(error.details?.dependents).toEqual([
        { id: page.created.id, kind: "page", name: expect.any(String) },
      ]);

      await service.archive(actor.context(), {
        kind: "page",
        id: page.created.id,
        expectedVersion: saved.version,
        idempotencyKey: idemKey(),
      });
      const archived = await service.archive(actor.context(), {
        kind: "board",
        id: board.id,
        expectedVersion: 1,
        idempotencyKey: idemKey(),
      });
      expect(archived.id).toBe(board.id);
    });

    it("blocks archiving a component pinned by a published page", async () => {
      const component = await createAndPublish(service, actor, { kind: "component" });
      const page = await createAndGet(service, actor, { kind: "page" });
      const saved = await service.saveDraft(actor.context(), {
        id: page.created.id,
        baseVersion: 1,
        document: pageWithBlocks(page.draft, [
          block("custom-component", { componentId: component.id, componentVersion: 1, props: {} }),
        ]),
      });
      await publishAs(actor, "page", page.created.id, saved.version);
      const error = await expectApiError(
        service.archive(actor.context(), {
          kind: "component",
          id: component.id,
          expectedVersion: component.version,
          idempotencyKey: idemKey(),
        }),
        "dependency-conflict",
      );
      expect(error.details?.dependents).toEqual([
        { id: page.created.id, kind: "page", name: expect.any(String) },
      ]);
    });

    it("ignores unpublished drafts that reference the target", async () => {
      const other = await createTenantActor(database);
      const component = await createAndPublish(service, other, { kind: "component" });
      const draftOnly = await createAndGet(service, other, { kind: "page" });
      await service.saveDraft(other.context(), {
        id: draftOnly.created.id,
        baseVersion: 1,
        document: pageWithBlocks(draftOnly.draft, [
          block("custom-component", { componentId: component.id, componentVersion: 1, props: {} }),
        ]),
      });
      const archived = await service.archive(other.context(), {
        kind: "component",
        id: component.id,
        expectedVersion: component.version,
        idempotencyKey: idemKey(),
      });
      expect(archived.id).toBe(component.id);
    });
  });

  describe("list cursor", () => {
    it.each([
      ["not base64 json", "!!"],
      ["non-uuid id", encodeCursor(new Date(), "not-a-uuid")],
      ["year 1970", encodeCursor(new Date(0), randomUUID())],
      ["year 9999", encodeCursor(new Date("9999-01-01T00:00:00Z"), randomUUID())],
      ["wrong shape", Buffer.from(JSON.stringify({ a: 1 })).toString("base64url")],
    ])("rejects %s as validation-failed", async (_name, cursor) => {
      await expectApiError(
        service.list(actor.context(), { kind: "page", search: null, cursor, limit: 5 }),
        "validation-failed",
      );
    });

    it("accepts a well-formed cursor", async () => {
      const result = await service.list(actor.context(), {
        kind: "page",
        search: null,
        cursor: encodeCursor(new Date(), randomUUID()),
        limit: 5,
      });
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe("audit correlation id", () => {
    it("records the caller correlation id, falling back to the request id", async () => {
      const correlationId = randomUUID();
      const created = await service.create(
        { ...actor.context(), correlationId },
        {
          kind: "component",
          key: `corr_${randomUUID().slice(0, 8)}`,
          name: "Correlated",
          template: { type: "blank" },
          idempotencyKey: idemKey(),
        },
      );
      const plainContext = actor.context();
      const second = await service.create(plainContext, {
        kind: "component",
        key: `corr_${randomUUID().slice(0, 8)}`,
        name: "Uncorrelated",
        template: { type: "blank" },
        idempotencyKey: idemKey(),
      });
      const [row] = await auditRowsFor(database, actor.tenantId, created.id);
      const [fallback] = await auditRowsFor(database, actor.tenantId, second.id);
      expect(row?.correlationId).toBe(correlationId);
      expect(fallback?.correlationId).toBe(plainContext.requestId);
    });
  });
});

describe("studio over HTTP", () => {
  let test: TestApp;
  let cookie: string;
  let tenantId: string;

  beforeAll(async () => {
    test = await createTestApp();
    const tenant = await createTenant(test.database);
    tenantId = tenant.id;
    const position = await createPosition(test.database, tenant.id, {
      studioView: true,
      studioEdit: true,
      studioPublish: true,
      studioEditCode: true,
    });
    const login = await createLoginUser(test, tenant.id, { positionIds: [position.id] });
    cookie = await signIn(test, login);
  });

  afterAll(async () => {
    await test.close();
  });

  it("serves studio.validate as a POST mutation and refuses it as a GET query", async () => {
    const post = await trpcMutation(
      test,
      "studio.validate",
      { document: { kind: "page", definition: {} } },
      { cookie },
    );
    expect(post.status).toBe(200);
    expect((post.data as { issues: unknown[] }).issues.length).toBeGreaterThan(0);

    const get = await trpcQuery(test, "studio.validate", {
      cookie,
      input: { document: { kind: "page", definition: {} } },
    });
    expect(get.status).toBe(405);
  });

  it("writes an incoming x-correlation-id UUID to the audit row", async () => {
    const correlationId = randomUUID();
    const created = await trpcMutation(
      test,
      "studio.create",
      {
        kind: "component",
        key: `http_${randomUUID().slice(0, 8)}`,
        name: "Over HTTP",
        template: { type: "blank" },
        idempotencyKey: idemKey(),
      },
      { cookie, headers: { "x-correlation-id": correlationId } },
    );
    expect(created.status).toBe(200);
    const id = (created.data as { id: string }).id;
    const [row] = await auditRowsFor(test.database, tenantId, id);
    expect(row?.correlationId).toBe(correlationId);
  });
});

describe("request log serializer", () => {
  it("logs method and path only, never the query string", () => {
    const logged = serializeRequestForLog({
      method: "GET",
      url: "/trpc/studio.get?input=%7B%22secret%22%3A1%7D#frag",
      ip: "10.0.0.1",
    });
    expect(logged).toEqual({ method: "GET", url: "/trpc/studio.get", remoteAddress: "10.0.0.1" });
    expect(JSON.stringify(logged)).not.toContain("secret");
  });
});
