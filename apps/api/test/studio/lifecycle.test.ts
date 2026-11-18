import { randomUUID } from "node:crypto";
import type { StudioDocument } from "@argus/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "../../src/db/client.js";
import { withSystemTransaction } from "../../src/db/transaction.js";
import { idempotencyKeys } from "../../src/persistence/system-schema.js";
import { createStudioService, type StudioService } from "../../src/studio/service.js";
import { createTestDatabase } from "../helpers/index.js";
import {
  type Actor,
  auditRowsFor,
  createAndGet,
  createAndPublish,
  createInput,
  createTenantActor,
  expectApiError,
  idemKey,
  uniqueKey,
  versionRowsFor,
} from "./support.js";

describe("studio lifecycle", () => {
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

  describe("happy path", () => {
    it("create -> saveDraft -> publish -> get -> rollback -> listVersions -> archive", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      expect(created.version).toBe(1);
      expect(draft.version).toBe(1);
      expect(draft.summary.hasUnpublishedChanges).toBe(true);
      expect(draft.summary.publishedVersion).toBeNull();
      expect(draft.document.kind).toBe("page");

      // get(published) is null before the first publish.
      expect(
        await service.get(actor.context(), { kind: "page", id: created.id, revision: "published" }),
      ).toBeNull();

      if (draft.document.kind !== "page") throw new Error("expected page");
      const edited: StudioDocument = {
        kind: "page",
        definition: { ...draft.document.definition, title: "Edited title" },
      };
      const saved = await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: edited,
      });
      expect(saved.version).toBe(2);

      const published = await service.publish(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 2,
        changeSummary: "first release",
        idempotencyKey: idemKey(),
      });
      expect(published.version).toBe(2);

      const live = await service.get(actor.context(), {
        kind: "page",
        id: created.id,
        revision: "published",
      });
      expect(live?.version).toBe(2);
      expect(live?.summary.hasUnpublishedChanges).toBe(false);
      expect(live?.summary.publishedAt).not.toBeNull();
      expect(live?.document.kind === "page" && live.document.definition.lifecycle).toBe(
        "published",
      );
      expect(live?.document.kind === "page" && live.document.definition.title).toBe("Edited title");
      expect(
        await service.get(actor.context(), { kind: "page", id: created.id, revision: "draft" }),
      ).toBeNull();

      // Draft on top of published, then publish again so there is something to roll back to.
      const draft3 = await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 2,
        document: { kind: "page", definition: { ...edited.definition, title: "Second title" } },
      });
      expect(draft3.version).toBe(3);
      await service.publish(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 3,
        changeSummary: "second release",
        idempotencyKey: idemKey(),
      });

      const restored = await service.rollback(actor.context(), {
        kind: "page",
        id: created.id,
        expectedPublishedVersion: 3,
        restoreVersion: 2,
        changeSummary: "revert to first release",
        idempotencyKey: idemKey(),
      });
      expect(restored.version).toBe(4);
      const afterRollback = await service.get(actor.context(), {
        kind: "page",
        id: created.id,
        revision: "published",
      });
      expect(afterRollback?.version).toBe(4);
      expect(
        afterRollback?.document.kind === "page" && afterRollback.document.definition.title,
      ).toBe("Edited title");

      const versions = await service.listVersions(actor.context(), {
        kind: "page",
        id: created.id,
      });
      expect(versions.map((v) => v.version)).toEqual([4, 3, 2]);
      expect(versions.every((v) => v.lifecycle === "published")).toBe(true);
      expect(versions[0]?.changeSummary).toBe("revert to first release");

      const archived = await service.archive(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 4,
        idempotencyKey: idemKey(),
      });
      expect(archived.version).toBe(4);
      const listed = await service.list(actor.context(), {
        kind: "page",
        search: null,
        cursor: null,
        limit: 200,
      });
      expect(listed.items.some((item) => item.id === created.id)).toBe(false);
      // History is kept and readable by studio callers.
      expect(
        (await service.listVersions(actor.context(), { kind: "page", id: created.id })).length,
      ).toBe(3);
    });

    it("rollback keeps an existing draft and rejects non-published restore targets", async () => {
      const { id } = await createAndPublish(service, actor, { kind: "component" });
      const draftDoc = await service.get(actor.context(), {
        kind: "component",
        id,
        revision: "published",
      });
      if (draftDoc?.document.kind !== "component") throw new Error("expected component");
      const draft = await service.saveDraft(actor.context(), {
        id,
        baseVersion: 1,
        document: draftDoc.document,
      });
      await expectApiError(
        service.rollback(actor.context(), {
          kind: "component",
          id,
          expectedPublishedVersion: 1,
          restoreVersion: draft.version,
          changeSummary: "bad",
          idempotencyKey: idemKey(),
        }),
        "validation-failed",
      );
      const restored = await service.rollback(actor.context(), {
        kind: "component",
        id,
        expectedPublishedVersion: 1,
        restoreVersion: 1,
        changeSummary: "same again",
        idempotencyKey: idemKey(),
      });
      expect(restored.version).toBe(draft.version + 1);
      const stillDraft = await service.get(actor.context(), {
        kind: "component",
        id,
        revision: "draft",
      });
      expect(stillDraft?.version).toBe(draft.version);
    });

    it("get with a numeric revision returns that version and not-found for unknown ones", async () => {
      const { id } = await createAndPublish(service, actor, { kind: "page" });
      const one = await service.get(actor.context(), { kind: "page", id, revision: 1 });
      expect(one?.version).toBe(1);
      await expectApiError(
        service.get(actor.context(), { kind: "page", id, revision: 99 }),
        "not-found",
      );
    });

    it("getPageBySlug returns the published, non-archived page only", async () => {
      const key = uniqueKey("slug_page");
      const created = await service.create(actor.context(), createInput({ kind: "page", key }));
      const slug = key.replace(/_/g, "-");
      expect(await service.getPageBySlug(actor.context(), { slug })).toBeNull();
      await service.publish(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 1,
        changeSummary: "go live",
        idempotencyKey: idemKey(),
      });
      const found = await service.getPageBySlug(actor.context(), { slug });
      expect(found?.summary.id).toBe(created.id);
      expect(found?.summary.slug).toBe(slug);
      await service.archive(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 1,
        idempotencyKey: idemKey(),
      });
      expect(await service.getPageBySlug(actor.context(), { slug })).toBeNull();
    });
  });

  describe("optimistic versions", () => {
    it("rejects a stale baseVersion on saveDraft with the current version", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: draft.document,
      });
      const error = await expectApiError(
        service.saveDraft(actor.context(), {
          id: created.id,
          baseVersion: 1,
          document: draft.document,
        }),
        "definition-version-conflict",
      );
      expect(error.details).toEqual({ currentVersion: 2 });
    });

    it("rejects stale expectedVersion on publish and archive, and stale expectedPublishedVersion on rollback", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: draft.document,
      });
      await expectApiError(
        service.publish(actor.context(), {
          kind: "page",
          id: created.id,
          expectedVersion: 1,
          changeSummary: "stale",
          idempotencyKey: idemKey(),
        }),
        "definition-version-conflict",
      );
      await expectApiError(
        service.archive(actor.context(), {
          kind: "page",
          id: created.id,
          expectedVersion: 1,
          idempotencyKey: idemKey(),
        }),
        "definition-version-conflict",
      );
      await service.publish(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 2,
        changeSummary: "ok",
        idempotencyKey: idemKey(),
      });
      await expectApiError(
        service.rollback(actor.context(), {
          kind: "page",
          id: created.id,
          expectedPublishedVersion: 1,
          restoreVersion: 2,
          changeSummary: "stale",
          idempotencyKey: idemKey(),
        }),
        "definition-version-conflict",
      );
    });

    it("lets exactly one of two concurrent saveDrafts with the same base win", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      if (draft.document.kind !== "page") throw new Error("expected page");
      const definition = draft.document.definition;
      const attempt = (title: string) =>
        service.saveDraft(actor.context(), {
          id: created.id,
          baseVersion: 1,
          document: { kind: "page", definition: { ...definition, title } },
        });
      const results = await Promise.allSettled([attempt("A"), attempt("B")]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = (rejected[0] as PromiseRejectedResult).reason as { cause?: { code?: string } };
      expect(reason.cause?.code).toBe("definition-version-conflict");
      const rows = await versionRowsFor(database, created.id);
      expect(rows.map((row) => row.version)).toEqual([2]);
    });

    it("rejects mutations on an archived definition", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      await service.archive(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 1,
        idempotencyKey: idemKey(),
      });
      await expectApiError(
        service.saveDraft(actor.context(), {
          id: created.id,
          baseVersion: 1,
          document: draft.document,
        }),
        "validation-failed",
      );
    });
  });

  describe("idempotency", () => {
    it("replays create with the stored output and one audit row", async () => {
      const input = createInput({ kind: "page" });
      const first = await service.create(actor.context(), input);
      const second = await service.create(actor.context(), input);
      expect(second).toEqual(first);
      expect(await auditRowsFor(database, actor.tenantId, first.id)).toHaveLength(1);
    });

    it("replays publish even after the definition moved on", async () => {
      const { created } = await createAndGet(service, actor, { kind: "page" });
      const input = {
        kind: "page" as const,
        id: created.id,
        expectedVersion: 1,
        changeSummary: "ship",
        idempotencyKey: idemKey(),
      };
      const first = await service.publish(actor.context(), input);
      const second = await service.publish(actor.context(), input);
      expect(second).toEqual(first);
      const audits = await auditRowsFor(database, actor.tenantId, created.id);
      expect(audits.filter((row) => row.operation === "publish")).toHaveLength(1);
    });

    it("rejects the same key with different input", async () => {
      const input = createInput({ kind: "page" });
      await service.create(actor.context(), input);
      const error = await expectApiError(
        service.create(actor.context(), { ...input, name: "Different name" }),
        "validation-failed",
      );
      expect(error.fieldErrors).toHaveProperty("idempotencyKey");
    });

    it("stores the key hash, not the raw input", async () => {
      const input = createInput({ kind: "page" });
      await service.create(actor.context(), input);
      const rows = await withSystemTransaction(database.db, (tx) =>
        tx.select().from(idempotencyKeys),
      );
      const row = rows.find((entry) => entry.key === input.idempotencyKey);
      expect(row?.requestHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row?.operation).toBe("studio.create");
    });

    it("rolls the claim back when the mutation fails so the key stays usable", async () => {
      const key = uniqueKey("dup");
      await service.create(actor.context(), createInput({ kind: "page", key }));
      const idempotencyKey = idemKey();
      await expectApiError(
        service.create(actor.context(), createInput({ kind: "page", key, idempotencyKey })),
        "validation-failed",
      );
      const retry = await service.create(
        actor.context(),
        createInput({ kind: "page", key: uniqueKey("fresh"), idempotencyKey }),
      );
      expect(retry.version).toBe(1);
    });
  });

  describe("audit", () => {
    it("writes one row per mutation with actor, position, request id and versions", async () => {
      const created = await service.create(actor.context(), createInput({ kind: "page" }));
      const draft = await service.get(actor.context(), {
        kind: "page",
        id: created.id,
        revision: "draft",
      });
      if (draft === null) throw new Error("draft expected");

      const context = actor.context();
      const save1 = await service.saveDraft(context, {
        id: created.id,
        baseVersion: 1,
        document: draft.document,
      });
      const publishContext = actor.context();
      const published = await service.publish(publishContext, {
        kind: "page",
        id: created.id,
        expectedVersion: 2,
        changeSummary: "publish it",
        idempotencyKey: idemKey(),
      });
      const save2 = await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 2,
        document: draft.document,
      });
      const rollbackContext = actor.context();
      const restored = await service.rollback(rollbackContext, {
        kind: "page",
        id: created.id,
        expectedPublishedVersion: 2,
        restoreVersion: 2,
        changeSummary: "restore it",
        idempotencyKey: idemKey(),
      });
      const archiveContext = actor.context();
      const archived = await service.archive(archiveContext, {
        kind: "page",
        id: created.id,
        expectedVersion: 3,
        idempotencyKey: idemKey(),
      });

      const rows = await auditRowsFor(database, actor.tenantId, created.id);
      const by = (operation: string) => rows.filter((row) => row.operation === operation);
      expect(rows).toHaveLength(6);
      expect(by("create-draft").map((r) => [r.previousVersion, r.version])).toEqual([
        [null, 1],
        [2, 3],
      ]);
      expect(by("update-draft").map((r) => [r.previousVersion, r.version])).toEqual([[1, 2]]);
      expect(by("publish")[0]).toMatchObject({
        id: published.auditEventId,
        previousVersion: null,
        version: 2,
        changeSummary: "publish it",
        requestId: publishContext.requestId,
      });
      expect(by("restore")[0]).toMatchObject({
        id: restored.auditEventId,
        previousVersion: 2,
        version: 4,
        changeSummary: "restore it",
        requestId: rollbackContext.requestId,
      });
      expect(by("archive")[0]).toMatchObject({
        id: archived.auditEventId,
        previousVersion: 3,
        version: 3,
        requestId: archiveContext.requestId,
      });
      expect(save1.version).toBe(2);
      expect(save2.version).toBe(3);
      for (const row of rows) {
        expect(row.tenantId).toBe(actor.tenantId);
        expect(row.actorUserId).toBe(actor.userId);
        expect(row.actorPositionId).toBe(actor.positionId);
        expect(row.definitionKind).toBe("page");
      }
    });
  });

  describe("server-owned metadata and documents", () => {
    it("overwrites client-supplied tenant, version, creator and lifecycle on write and read", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "page" });
      if (draft.document.kind !== "page") throw new Error("expected page");
      const attacker = randomUUID();
      const forged: StudioDocument = {
        kind: "page",
        definition: {
          ...draft.document.definition,
          id: randomUUID(),
          tenantId: attacker,
          version: 99,
          lifecycle: "published",
          createdBy: attacker,
          createdPositionId: attacker,
          createdAt: "1999-01-01T00:00:00.000Z",
          publishedAt: "1999-01-01T00:00:00.000Z",
          publishedBy: attacker,
          changeSummary: "forged",
        },
      };
      const saved = await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: forged,
      });
      const read = await service.get(actor.context(), {
        kind: "page",
        id: created.id,
        revision: "draft",
      });
      if (read?.document.kind !== "page") throw new Error("expected page");
      expect(read.document.definition).toMatchObject({
        id: created.id,
        tenantId: actor.tenantId,
        version: saved.version,
        lifecycle: "draft",
        createdBy: actor.userId,
        createdPositionId: actor.positionId,
        publishedAt: null,
        publishedBy: null,
        changeSummary: null,
      });
      expect(read.document.definition.createdAt).not.toBe("1999-01-01T00:00:00.000Z");
      const [row] = await versionRowsFor(database, created.id);
      expect(JSON.stringify(row?.document)).not.toContain(attacker);
    });

    it("rejects a document whose kind does not match the definition", async () => {
      const page = await createAndGet(service, actor, { kind: "page" });
      const component = await createAndGet(service, actor, { kind: "component" });
      await expectApiError(
        service.saveDraft(actor.context(), {
          id: page.created.id,
          baseVersion: 1,
          document: component.draft.document,
        }),
        "validation-failed",
      );
    });

    it("stores component source verbatim and never executes it", async () => {
      const { created, draft } = await createAndGet(service, actor, { kind: "component" });
      if (draft.document.kind !== "component") throw new Error("expected component");
      const hostile = `throw new Error("boom");\nprocess.exit(1);\nglobalThis.__pwned = true;\nrequire("node:fs");`;
      await service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: {
          kind: "component",
          definition: { ...draft.document.definition, source: hostile },
        },
      });
      const read = await service.get(actor.context(), {
        kind: "component",
        id: created.id,
        revision: "draft",
      });
      expect(read?.document.kind === "component" && read.document.definition.source).toBe(hostile);
      expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
    });

    it("reports duplicate page slugs and keys as validation-failed with field errors", async () => {
      const key = uniqueKey("taken");
      await service.create(actor.context(), createInput({ kind: "page", key }));
      const sameKey = await expectApiError(
        service.create(actor.context(), createInput({ kind: "page", key })),
        "validation-failed",
      );
      expect(
        Object.keys(sameKey.fieldErrors).some((field) => field === "key" || field === "slug"),
      ).toBe(true);

      // Same slug with a different key: key "x_y" and "x__y" both map to slug "x-y".
      const base = uniqueKey("slugclash").replace(/_/g, "");
      await service.create(actor.context(), createInput({ kind: "page", key: `${base}_a` }));
      const clash = await expectApiError(
        service.create(actor.context(), createInput({ kind: "page", key: `${base}__a` })),
        "validation-failed",
      );
      expect(clash.fieldErrors).toHaveProperty("slug");
      expect(clash.message).not.toMatch(/constraint|insert into|sql/i);

      const component = uniqueKey("comp");
      await service.create(actor.context(), createInput({ kind: "component", key: component }));
      const dupComponent = await expectApiError(
        service.create(actor.context(), createInput({ kind: "component", key: component })),
        "validation-failed",
      );
      expect(dupComponent.fieldErrors).toHaveProperty("key");
    });
  });

  describe("list", () => {
    it("paginates with an opaque keyset cursor, searches with escaped wildcards", async () => {
      const lister = await createTenantActor(database);
      const names = ["Alpha 100%", "Alpha 1000", "Bravo", "Charlie_x", "Charlie-y"];
      for (const name of names) {
        await service.create(
          lister.context(),
          createInput({ kind: "component", key: uniqueKey("c"), name }),
        );
      }
      const collected: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 10; page += 1) {
        const result = await service.list(lister.context(), {
          kind: "component",
          search: null,
          cursor,
          limit: 2,
        });
        collected.push(...result.items.map((item) => item.name));
        cursor = result.nextCursor;
        if (cursor === null) break;
        expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
      }
      expect(collected).toHaveLength(5);
      expect(new Set(collected)).toEqual(new Set(names));

      const percent = await service.list(lister.context(), {
        kind: "component",
        search: "100%",
        cursor: null,
        limit: 10,
      });
      expect(percent.items.map((i) => i.name)).toEqual(["Alpha 100%"]);
      const underscore = await service.list(lister.context(), {
        kind: "component",
        search: "Charlie_",
        cursor: null,
        limit: 10,
      });
      expect(underscore.items.map((i) => i.name)).toEqual(["Charlie_x"]);

      await expectApiError(
        service.list(lister.context(), { kind: "component", search: null, cursor: "!!", limit: 5 }),
        "validation-failed",
      );
    });
  });

  describe("templates", () => {
    it("rejects blank boards, reports from-table as not implemented", async () => {
      const blank = await expectApiError(
        service.create(actor.context(), createInput({ kind: "board" })),
        "validation-failed",
      );
      expect(blank.message).toMatch(/table/i);
      const fromTable = await expectApiError(
        service.create(
          actor.context(),
          createInput({ kind: "page", template: { type: "from-table", tableId: randomUUID() } }),
        ),
        "unavailable",
      );
      expect(fromTable.message.startsWith("TODO(implementation): from-table")).toBe(true);
      expect(fromTable.retryable).toBe(false);
    });

    it("ejects a block into a labelled starter component", async () => {
      const created = await service.create(
        actor.context(),
        createInput({ kind: "component", template: { type: "eject-block", blockType: "stat" } }),
      );
      const read = await service.get(actor.context(), {
        kind: "component",
        id: created.id,
        revision: "draft",
      });
      if (read?.document.kind !== "component") throw new Error("expected component");
      expect(read.document.definition.ejectedFrom).toBe("stat");
      expect(read.document.definition.source).toContain(
        "Ejected from stat — starter, not the built-in implementation",
      );
      expect(read.document.definition.sdkVersion).toBe(1);
      expect(read.document.definition.capabilities).toEqual([]);
      await expectApiError(
        service.create(
          actor.context(),
          createInput({ kind: "page", template: { type: "eject-block", blockType: "stat" } }),
        ),
        "validation-failed",
      );
    });

    it("duplicates the published version of a same-kind source and rejects unpublished or wrong-kind sources", async () => {
      const source = await createAndPublish(service, actor, { kind: "component" });
      const copyKey = uniqueKey("copy");
      const copy = await service.create(
        actor.context(),
        createInput({
          kind: "component",
          key: copyKey,
          name: "Copied",
          template: { type: "duplicate", sourceId: source.id },
        }),
      );
      expect(copy.id).not.toBe(source.id);
      const read = await service.get(actor.context(), {
        kind: "component",
        id: copy.id,
        revision: "draft",
      });
      if (read?.document.kind !== "component" || source.draft.document.kind !== "component") {
        throw new Error("expected components");
      }
      expect(read.document.definition.key).toBe(copyKey);
      expect(read.document.definition.name).toBe("Copied");
      expect(read.document.definition.source).toBe(source.draft.document.definition.source);

      const unpublished = await createAndGet(service, actor, { kind: "component" });
      await expectApiError(
        service.create(
          actor.context(),
          createInput({
            kind: "component",
            template: { type: "duplicate", sourceId: unpublished.created.id },
          }),
        ),
        "not-found",
      );
      await expectApiError(
        service.create(
          actor.context(),
          createInput({ kind: "page", template: { type: "duplicate", sourceId: source.id } }),
        ),
        "not-found",
      );
    });
  });
});
