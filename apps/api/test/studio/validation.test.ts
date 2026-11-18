import { randomUUID } from "node:crypto";
import type { BlockDefinition, StudioDocument } from "@argus/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "../../src/db/client.js";
import { createStudioService, type StudioService } from "../../src/studio/service.js";
import { createStarterDocument } from "../../src/studio/templates.js";
import { type StudioReferenceLookup, validateStudioDocument } from "../../src/studio/validation.js";
import { createTestDatabase } from "../helpers/index.js";
import {
  type Actor,
  boardDocument,
  createAndGet,
  createAndPublish,
  createTenantActor,
  expectApiError,
  idemKey,
  seedPublishedBoard,
} from "./support.js";

function fakeLookup(overrides: Partial<StudioReferenceLookup> = {}): StudioReferenceLookup {
  return {
    publishedBoardExists: async () => false,
    publishedComponentVersionExists: async () => false,
    existingPositions: async (ids) => ids,
    positionsClaimedByOtherPage: async () => [],
    ...overrides,
  };
}

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

function pageWith(blocks: BlockDefinition[], extra: Record<string, unknown> = {}): StudioDocument {
  const starter = createStarterDocument({
    kind: "page",
    key: "validation_page",
    name: "Validation",
    template: { type: "blank" },
  });
  if (starter.kind !== "page") throw new Error("expected page");
  return {
    kind: "page",
    definition: {
      ...starter.definition,
      id: randomUUID(),
      blocks,
      layouts: [{ breakpoint: "desktop", items: [] }],
      ...extra,
    },
  };
}

function messages(issues: { message: string }[]): string[] {
  return issues.map((issue) => issue.message);
}

describe("validateStudioDocument", () => {
  it("maps schema errors to error issues with paths and returns only those", async () => {
    const issues = await validateStudioDocument(
      { kind: "page", definition: { nope: true } },
      fakeLookup(),
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.severity === "error")).toBe(true);
    expect(issues.some((issue) => issue.path[0] === "definition")).toBe(true);
    // No CEL notice when the schema already failed.
    expect(messages(issues).join(" ")).not.toMatch(/CEL/);
    expect(await validateStudioDocument("garbage", fakeLookup())).not.toEqual([]);
    expect(await validateStudioDocument(null, fakeLookup())).not.toEqual([]);
  });

  it("accepts a valid blank page and component with no issues", async () => {
    const page = pageWith([]);
    expect(await validateStudioDocument(page, fakeLookup())).toEqual([]);
    const component = createStarterDocument({
      kind: "component",
      key: "valid_component",
      name: "Valid",
      template: { type: "blank" },
    });
    expect(await validateStudioDocument(component, fakeLookup())).toEqual([]);
  });

  describe("boards", () => {
    it("accepts a consistent bundle", async () => {
      expect(await validateStudioDocument(boardDocument({}), fakeLookup())).toEqual([]);
    });

    it("flags layout items referencing a missing block", async () => {
      const board = boardDocument({});
      board.bundle.layout.layouts = [
        {
          breakpoint: "desktop",
          items: [{ blockId: randomUUID(), x: 0, y: 0, width: 4, height: 2, hidden: false }],
        },
      ];
      const issues = await validateStudioDocument(board, fakeLookup());
      expect(issues).toContainEqual({
        path: ["bundle", "layout", "layouts", 0, "items", 0, "blockId"],
        message: "Layout item references a block that does not exist.",
        severity: "error",
      });
    });

    it("flags layout.boardId and definition.layoutId mismatches", async () => {
      const board = boardDocument({});
      board.bundle.layout.boardId = randomUUID();
      board.bundle.definition.layoutId = randomUUID();
      const issues = await validateStudioDocument(board, fakeLookup());
      expect(issues.map((i) => i.path.join("."))).toEqual(
        expect.arrayContaining(["bundle.layout.boardId", "bundle.definition.layoutId"]),
      );
    });

    it("flags duplicate block ids, duplicate breakpoints and board-embed in boards", async () => {
      const board = boardDocument({});
      const shared = block("divider", {});
      board.bundle.definition.blocks = [
        shared,
        shared,
        block("board-embed", { boardId: randomUUID() }),
      ];
      board.bundle.layout.layouts = [
        { breakpoint: "desktop", items: [] },
        { breakpoint: "desktop", items: [] },
      ];
      const text = messages(await validateStudioDocument(board, fakeLookup())).join("|");
      expect(text).toMatch(/Block ids must be unique/);
      expect(text).toMatch(/Duplicate layout for breakpoint/);
      expect(text).toMatch(/only supported on pages/);
    });
  });

  describe("pages", () => {
    it("flags a board-embed pointing to a missing or unpublished board", async () => {
      const missing = pageWith([block("board-embed", { boardId: randomUUID(), showHeader: true })]);
      const issues = await validateStudioDocument(missing, fakeLookup());
      expect(issues).toContainEqual(
        expect.objectContaining({
          path: ["definition", "blocks", 0, "config", "boardId"],
          severity: "error",
        }),
      );
      const found = await validateStudioDocument(
        missing,
        fakeLookup({ publishedBoardExists: async () => true }),
      );
      expect(found).toEqual([]);
      const noId = pageWith([block("board-embed", {})]);
      expect(messages(await validateStudioDocument(noId, fakeLookup()))[0]).toMatch(/boardId/);
    });

    it("flags a custom-component pin to a missing or unpublished version and bad config", async () => {
      const componentId = randomUUID();
      const page = pageWith([
        block("custom-component", { componentId, componentVersion: 3, props: {} }),
      ]);
      const issues = await validateStudioDocument(page, fakeLookup());
      expect(issues).toContainEqual(
        expect.objectContaining({
          path: ["definition", "blocks", 0, "config", "componentVersion"],
          severity: "error",
        }),
      );
      const asked: [string, number][] = [];
      expect(
        await validateStudioDocument(
          page,
          fakeLookup({
            publishedComponentVersionExists: async (id, version) => {
              asked.push([id, version]);
              return true;
            },
          }),
        ),
      ).toEqual([]);
      expect(asked).toEqual([[componentId, 3]]);

      const bad = pageWith([block("custom-component", { componentId: "nope" })]);
      const badIssues = await validateStudioDocument(bad, fakeLookup());
      expect(badIssues.length).toBeGreaterThan(0);
      expect(badIssues.every((i) => i.path.slice(0, 3).join(".") === "definition.blocks.0")).toBe(
        true,
      );
    });

    it("flags duplicate, unknown and already-claimed homepage positions", async () => {
      const a = randomUUID();
      const unknown = randomUUID();
      const claimed = randomUUID();
      const page = pageWith([], { homepageForPositionIds: [a, a, unknown, claimed] });
      const issues = await validateStudioDocument(
        page,
        fakeLookup({
          existingPositions: async (ids) => ids.filter((id) => id !== unknown),
          positionsClaimedByOtherPage: async (ids) => ids.filter((id) => id === claimed),
        }),
      );
      const byIndex = new Map(issues.map((issue) => [issue.path.at(-1), issue.message]));
      expect(byIndex.get(1)).toMatch(/Duplicate homepage position/);
      expect(byIndex.get(2)).toMatch(/does not exist/);
      expect(byIndex.get(3)).toMatch(/already has another published page/);
      expect(byIndex.has(0)).toBe(false);
    });

    it("excludes the page itself when asking who else claims a homepage", async () => {
      const page = pageWith([], { homepageForPositionIds: [randomUUID()] });
      let excluded: string | null = "unset";
      await validateStudioDocument(
        page,
        fakeLookup({
          positionsClaimedByOtherPage: async (_ids, exclude) => {
            excluded = exclude;
            return [];
          },
        }),
      );
      expect(excluded).toBe(page.kind === "page" ? page.definition.id : null);
    });
  });

  describe("components", () => {
    it("flags duplicate prop keys and options on non-enum props", async () => {
      const starter = createStarterDocument({
        kind: "component",
        key: "props_component",
        name: "Props",
        template: { type: "blank" },
      });
      if (starter.kind !== "component") throw new Error("expected component");
      const prop = (
        key: string,
        type: "string" | "enum",
        options: { value: string; label: string }[],
      ) => ({
        key,
        label: key,
        description: null,
        type,
        required: false,
        defaultValue: null,
        options,
      });
      const doc: StudioDocument = {
        kind: "component",
        definition: {
          ...starter.definition,
          props: [
            prop("title", "string", [{ value: "a", label: "A" }]),
            prop("title", "string", []),
            prop("mode", "enum", [{ value: "a", label: "A" }]),
          ],
        },
      };
      const issues = await validateStudioDocument(doc, fakeLookup());
      const text = issues.map((i) => `${i.path.join(".")}:${i.message}`);
      expect(text).toContain("definition.props.1.key:Prop keys must be unique.");
      expect(text).toContain("definition.props.0.options:Options are only allowed for enum props.");
      expect(issues).toHaveLength(2);
    });
  });

  describe("CEL", () => {
    it("emits exactly one warning at path [] while the parser is a stub", async () => {
      const withCel = pageWith([
        { ...block("divider", {}), visibilityExpression: "incident.level > 2" },
        { ...block("divider", {}), visibilityExpression: "user.active" },
      ]);
      const issues = await validateStudioDocument(withCel, fakeLookup());
      expect(issues).toEqual([
        {
          path: [],
          message: "CEL expressions were not checked: the CEL parser is not implemented yet.",
          severity: "warning",
        },
      ]);
    });

    it("emits no CEL notice when the document has no CEL", async () => {
      expect(await validateStudioDocument(pageWith([block("divider", {})]), fakeLookup())).toEqual(
        [],
      );
    });
  });
});

describe("studio.validate and publish through the service", () => {
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

  it("returns issues for schema-invalid documents instead of rejecting", async () => {
    const result = await service.validate(actor.context(), {
      document: { kind: "page", definition: {} } as unknown as StudioDocument,
    });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
  });

  it("resolves board-embed references against published boards in the tenant", async () => {
    const { created, draft } = await createAndGet(service, actor, { kind: "page" });
    if (draft.document.kind !== "page") throw new Error("expected page");
    const withEmbed = (boardId: string): StudioDocument => {
      if (draft.document.kind !== "page") throw new Error("expected page");
      const embed = block("board-embed", { boardId, showHeader: true });
      return {
        kind: "page",
        definition: {
          ...draft.document.definition,
          blocks: [embed],
          layouts: [
            {
              breakpoint: "desktop",
              items: [{ blockId: embed.id, x: 0, y: 0, width: 6, height: 4, hidden: false }],
            },
          ],
        },
      };
    };
    const missing = await service.validate(actor.context(), { document: withEmbed(randomUUID()) });
    expect(missing.issues.some((i) => i.severity === "error")).toBe(true);

    const board = await seedPublishedBoard(database, actor);
    const ok = await service.validate(actor.context(), { document: withEmbed(board.id) });
    expect(ok.issues).toEqual([]);

    // Saving a draft with a broken reference is allowed (work in progress) but publishing is not.
    const saved = await service.saveDraft(actor.context(), {
      id: created.id,
      baseVersion: 1,
      document: withEmbed(randomUUID()),
    });
    const error = await expectApiError(
      service.publish(actor.context(), {
        kind: "page",
        id: created.id,
        expectedVersion: saved.version,
        changeSummary: "should fail",
        idempotencyKey: idemKey(),
      }),
      "validation-failed",
    );
    expect(Object.keys(error.fieldErrors).some((key) => key.includes("boardId"))).toBe(true);
    // The draft is still there, unpublished.
    expect(
      (await service.get(actor.context(), { kind: "page", id: created.id, revision: "draft" }))
        ?.version,
    ).toBe(saved.version);
  });

  it("rejects a homepage claimed by another published page and allows it for the same page", async () => {
    const first = await createAndGet(service, actor, { kind: "page" });
    const second = await createAndGet(service, actor, { kind: "page" });
    const positionId = actor.positionId;
    const claim = async (created: { id: string }, draft: typeof first.draft) => {
      if (draft.document.kind !== "page") throw new Error("expected page");
      return service.saveDraft(actor.context(), {
        id: created.id,
        baseVersion: 1,
        document: {
          kind: "page",
          definition: { ...draft.document.definition, homepageForPositionIds: [positionId] },
        },
      });
    };
    const firstSaved = await claim(first.created, first.draft);
    const secondSaved = await claim(second.created, second.draft);
    await service.publish(actor.context(), {
      kind: "page",
      id: first.created.id,
      expectedVersion: firstSaved.version,
      changeSummary: "claims homepage",
      idempotencyKey: idemKey(),
    });
    await expectApiError(
      service.publish(actor.context(), {
        kind: "page",
        id: second.created.id,
        expectedVersion: secondSaved.version,
        changeSummary: "also claims homepage",
        idempotencyKey: idemKey(),
      }),
      "validation-failed",
    );
    // Re-validating the first page's own draft does not flag itself.
    const reread = await service.get(actor.context(), {
      kind: "page",
      id: first.created.id,
      revision: "published",
    });
    if (reread === null) throw new Error("expected published page");
    expect((await service.validate(actor.context(), { document: reread.document })).issues).toEqual(
      [],
    );
  });

  it("publishes components pinned by pages only once the component version is published", async () => {
    const component = await createAndGet(service, actor, { kind: "component" });
    const page = await createAndGet(service, actor, { kind: "page" });
    if (page.draft.document.kind !== "page") throw new Error("expected page");
    const pin = block("custom-component", {
      componentId: component.created.id,
      componentVersion: 1,
      props: {},
    });
    const pageDoc: StudioDocument = {
      kind: "page",
      definition: {
        ...page.draft.document.definition,
        blocks: [pin],
        layouts: [
          {
            breakpoint: "desktop",
            items: [{ blockId: pin.id, x: 0, y: 0, width: 4, height: 3, hidden: false }],
          },
        ],
      },
    };
    expect(
      (await service.validate(actor.context(), { document: pageDoc })).issues.some(
        (issue) => issue.severity === "error",
      ),
    ).toBe(true);
    await service.publish(actor.context(), {
      kind: "component",
      id: component.created.id,
      expectedVersion: 1,
      changeSummary: "publish component",
      idempotencyKey: idemKey(),
    });
    expect((await service.validate(actor.context(), { document: pageDoc })).issues).toEqual([]);
    const published = await createAndPublish(service, actor, { kind: "page" });
    expect(published.version).toBe(1);
  });
});
