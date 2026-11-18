import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "../../src/db/client.js";
import { withTenantTransaction } from "../../src/db/transaction.js";
import { studioDefinitions } from "../../src/persistence/system-schema.js";
import { createStudioService, type StudioService } from "../../src/studio/service.js";
import { createTestDatabase } from "../helpers/index.js";
import {
  type Actor,
  addActor,
  createAndGet,
  createAndPublish,
  createInput,
  createTenantActor,
  expectApiError,
  idemKey,
} from "./support.js";

describe("studio permissions and tenant isolation", () => {
  let database: DatabaseHandle;
  let service: StudioService;
  let admin: Actor;

  beforeAll(async () => {
    database = await createTestDatabase();
    service = createStudioService({ database: database.db });
    admin = await createTenantActor(database);
  });

  afterAll(async () => {
    await database.close();
  });

  describe("studio viewer", () => {
    it("can list and read drafts and versions but not save, publish or archive", async () => {
      const viewer = await addActor(database, admin.tenantId, { studioView: true });
      const { created, draft } = await createAndGet(service, admin, { kind: "page" });

      const listed = await service.list(viewer.context(), {
        kind: "page",
        search: null,
        cursor: null,
        limit: 200,
      });
      const item = listed.items.find((entry) => entry.id === created.id);
      expect(item?.permissions).toEqual({
        view: true,
        edit: false,
        publish: false,
        editCode: false,
      });
      expect(
        await service.get(viewer.context(), { kind: "page", id: created.id, revision: "draft" }),
      ).not.toBeNull();
      expect(
        await service.listVersions(viewer.context(), { kind: "page", id: created.id }),
      ).toHaveLength(1);

      await expectApiError(
        service.saveDraft(viewer.context(), {
          id: created.id,
          baseVersion: 1,
          document: draft.document,
        }),
        "forbidden",
      );
      await expectApiError(
        service.publish(viewer.context(), {
          kind: "page",
          id: created.id,
          expectedVersion: 1,
          changeSummary: "no",
          idempotencyKey: idemKey(),
        }),
        "forbidden",
      );
      await expectApiError(
        service.archive(viewer.context(), {
          kind: "page",
          id: created.id,
          expectedVersion: 1,
          idempotencyKey: idemKey(),
        }),
        "forbidden",
      );
      await expectApiError(
        service.create(viewer.context(), createInput({ kind: "page" })),
        "forbidden",
      );
    });

    it("an editor without publish permission can save but not publish or roll back", async () => {
      const editor = await addActor(database, admin.tenantId, {
        studioView: true,
        studioEdit: true,
      });
      const created = await service.create(editor.context(), createInput({ kind: "page" }));
      await expectApiError(
        service.publish(editor.context(), {
          kind: "page",
          id: created.id,
          expectedVersion: 1,
          changeSummary: "no",
          idempotencyKey: idemKey(),
        }),
        "forbidden",
      );
    });
  });

  describe("components require editCode", () => {
    it("denies create/save/publish for edit-only positions and allows with editCode", async () => {
      const noCode = await addActor(database, admin.tenantId, {
        studioView: true,
        studioEdit: true,
        studioPublish: true,
      });
      await expectApiError(
        service.create(noCode.context(), createInput({ kind: "component" })),
        "forbidden",
      );
      const { created, draft } = await createAndGet(service, admin, { kind: "component" });
      await expectApiError(
        service.saveDraft(noCode.context(), {
          id: created.id,
          baseVersion: 1,
          document: draft.document,
        }),
        "forbidden",
      );
      await expectApiError(
        service.publish(noCode.context(), {
          kind: "component",
          id: created.id,
          expectedVersion: 1,
          changeSummary: "no",
          idempotencyKey: idemKey(),
        }),
        "forbidden",
      );
      const listed = await service.list(noCode.context(), {
        kind: "component",
        search: null,
        cursor: null,
        limit: 200,
      });
      expect(listed.items.find((i) => i.id === created.id)?.permissions).toMatchObject({
        edit: false,
        publish: false,
        editCode: false,
      });

      const coder = await addActor(database, admin.tenantId, {
        studioView: true,
        studioEdit: true,
        studioEditCode: true,
      });
      const saved = await service.saveDraft(coder.context(), {
        id: created.id,
        baseVersion: 1,
        document: draft.document,
      });
      expect(saved.version).toBe(2);
    });
  });

  describe("non-studio positions", () => {
    it("see only published, access-allowed items and cannot read drafts", async () => {
      const responder = await addActor(database, admin.tenantId, {});
      const otherPosition = await addActor(database, admin.tenantId, {});

      const open = await createAndPublish(service, admin, { kind: "page" });
      const draftOnly = await createAndGet(service, admin, { kind: "page" });

      // A page restricted to `otherPosition` (published).
      const restricted = await createAndGet(service, admin, { kind: "page" });
      if (restricted.draft.document.kind !== "page") throw new Error("expected page");
      await service.saveDraft(admin.context(), {
        id: restricted.created.id,
        baseVersion: 1,
        document: {
          kind: "page",
          definition: {
            ...restricted.draft.document.definition,
            access: { positionIds: [otherPosition.positionId], visibilityRule: null },
          },
        },
      });
      await service.publish(admin.context(), {
        kind: "page",
        id: restricted.created.id,
        expectedVersion: 2,
        changeSummary: "restricted",
        idempotencyKey: idemKey(),
      });

      // A page with a CEL visibility rule is hidden (the rule cannot be evaluated yet).
      const ruled = await createAndGet(service, admin, { kind: "page" });
      if (ruled.draft.document.kind !== "page") throw new Error("expected page");
      await service.saveDraft(admin.context(), {
        id: ruled.created.id,
        baseVersion: 1,
        document: {
          kind: "page",
          definition: {
            ...ruled.draft.document.definition,
            access: { positionIds: [], visibilityRule: "true" },
          },
        },
      });
      await service.publish(admin.context(), {
        kind: "page",
        id: ruled.created.id,
        expectedVersion: 2,
        changeSummary: "ruled",
        idempotencyKey: idemKey(),
      });

      const listed = await service.list(responder.context(), {
        kind: "page",
        search: null,
        cursor: null,
        limit: 200,
      });
      const ids = listed.items.map((entry) => entry.id);
      expect(ids).toContain(open.id);
      expect(ids).not.toContain(draftOnly.created.id);
      expect(ids).not.toContain(restricted.created.id);
      expect(ids).not.toContain(ruled.created.id);

      const allowed = await service.list(otherPosition.context(), {
        kind: "page",
        search: null,
        cursor: null,
        limit: 200,
      });
      expect(allowed.items.map((entry) => entry.id)).toContain(restricted.created.id);

      expect(
        (
          await service.get(responder.context(), {
            kind: "page",
            id: open.id,
            revision: "published",
          })
        )?.version,
      ).toBe(1);
      // Accessible item, missing permission -> forbidden.
      await expectApiError(
        service.get(responder.context(), { kind: "page", id: open.id, revision: "draft" }),
        "forbidden",
      );
      await expectApiError(
        service.listVersions(responder.context(), { kind: "page", id: open.id }),
        "forbidden",
      );
      // Inaccessible item -> not-found, never forbidden.
      await expectApiError(
        service.get(responder.context(), {
          kind: "page",
          id: draftOnly.created.id,
          revision: "draft",
        }),
        "not-found",
      );
      await expectApiError(
        service.get(responder.context(), {
          kind: "page",
          id: restricted.created.id,
          revision: "published",
        }),
        "not-found",
      );
      await expectApiError(
        service.archive(responder.context(), {
          kind: "page",
          id: restricted.created.id,
          expectedVersion: 2,
          idempotencyKey: idemKey(),
        }),
        "not-found",
      );
      await expectApiError(
        service.validate(responder.context(), {
          document: open.draft.document,
        }),
        "forbidden",
      );
    });

    it("getPageBySlug hides pages the caller's position may not see", async () => {
      const responder = await addActor(database, admin.tenantId, {});
      const other = await addActor(database, admin.tenantId, {});
      const { created, draft } = await createAndGet(service, admin, { kind: "page" });
      if (draft.document.kind !== "page") throw new Error("expected page");
      await service.saveDraft(admin.context(), {
        id: created.id,
        baseVersion: 1,
        document: {
          kind: "page",
          definition: {
            ...draft.document.definition,
            access: { positionIds: [other.positionId], visibilityRule: null },
          },
        },
      });
      await service.publish(admin.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: 2,
        changeSummary: "restricted",
        idempotencyKey: idemKey(),
      });
      const slug = draft.document.definition.slug;
      expect(await service.getPageBySlug(responder.context(), { slug })).toBeNull();
      expect((await service.getPageBySlug(other.context(), { slug }))?.summary.id).toBe(created.id);
    });
  });

  describe("tenant isolation", () => {
    it("tenant B cannot get, list, save, publish, rollback, archive or version tenant A's definitions", async () => {
      const tenantB = await createTenantActor(database);
      const a = await createAndPublish(service, admin, { kind: "page" });
      const aDraft = await createAndGet(service, admin, { kind: "page" });

      const listedB = await service.list(tenantB.context(), {
        kind: "page",
        search: null,
        cursor: null,
        limit: 200,
      });
      expect(listedB.items).toEqual([]);

      await expectApiError(
        service.get(tenantB.context(), { kind: "page", id: a.id, revision: "published" }),
        "not-found",
      );
      await expectApiError(
        service.get(tenantB.context(), {
          kind: "page",
          id: aDraft.created.id,
          revision: "draft",
        }),
        "not-found",
      );
      await expectApiError(
        service.listVersions(tenantB.context(), { kind: "page", id: a.id }),
        "not-found",
      );
      await expectApiError(
        service.saveDraft(tenantB.context(), {
          id: aDraft.created.id,
          baseVersion: 1,
          document: aDraft.draft.document,
        }),
        "not-found",
      );
      await expectApiError(
        service.publish(tenantB.context(), {
          kind: "page",
          id: aDraft.created.id,
          expectedVersion: 1,
          changeSummary: "x",
          idempotencyKey: idemKey(),
        }),
        "not-found",
      );
      await expectApiError(
        service.rollback(tenantB.context(), {
          kind: "page",
          id: a.id,
          expectedPublishedVersion: 1,
          restoreVersion: 1,
          changeSummary: "x",
          idempotencyKey: idemKey(),
        }),
        "not-found",
      );
      await expectApiError(
        service.archive(tenantB.context(), {
          kind: "page",
          id: a.id,
          expectedVersion: 1,
          idempotencyKey: idemKey(),
        }),
        "not-found",
      );
      await expectApiError(
        service.create(
          tenantB.context(),
          createInput({ kind: "page", template: { type: "duplicate", sourceId: a.id } }),
        ),
        "not-found",
      );
      const slug =
        a.draft.document.kind === "page" ? a.draft.document.definition.slug : randomUUID();
      expect(await service.getPageBySlug(tenantB.context(), { slug })).toBeNull();

      // Tenant A is untouched.
      expect(
        (await service.get(admin.context(), { kind: "page", id: a.id, revision: "published" }))
          ?.version,
      ).toBe(1);
    });

    it("row-level security hides other tenants' catalog rows even without predicates", async () => {
      const tenantB = await createTenantActor(database);
      await createAndGet(service, tenantB, { kind: "page" });
      const seen = await withTenantTransaction(
        database.db,
        {
          tenantId: admin.tenantId,
          userId: admin.userId,
          positionId: admin.positionId,
          requestId: randomUUID(),
        },
        (tx) => tx.select({ tenantId: studioDefinitions.tenantId }).from(studioDefinitions),
      );
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((row) => row.tenantId === admin.tenantId)).toBe(true);
    });

    it("a position id from another tenant is not usable as the acting position", async () => {
      const tenantB = await createTenantActor(database);
      await expectApiError(
        service.list(
          { ...admin.context(), positionId: tenantB.positionId },
          { kind: "page", search: null, cursor: null, limit: 5 },
        ),
        "forbidden",
      );
    });
  });
});
