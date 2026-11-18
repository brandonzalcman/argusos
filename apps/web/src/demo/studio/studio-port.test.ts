import type { StudioDocument } from "@argus/schema";
import { describe, expect, it } from "vitest";
import { DEMO_POSITIONS, DEMO_TABLES } from "../scenario.js";
import { DEMO_COMPONENTS, DEMO_PAGES } from "./seed.js";
import { createDemoSessionPort } from "./session.js";
import { createDemoStudioPort } from "./studio-port.js";

function setup() {
  const session = createDemoSessionPort(0);
  const studio = createDemoStudioPort(session, { latencyMs: 0 });
  return { session, studio };
}

type Studio = ReturnType<typeof setup>["studio"];

let keyCounter = 0;
function nextKey(): number {
  keyCounter += 1;
  return keyCounter;
}
const idem = (): string => `test-key-${nextKey()}-abcdefgh`;

function createPage(studio: Studio, key: string) {
  return studio.create({
    kind: "page",
    key,
    name: key,
    template: { type: "blank" },
    idempotencyKey: idem(),
  });
}

async function draftPage(studio: Studio, id: string) {
  const draft = await studio.get({ kind: "page", id, revision: "draft" });
  if (draft?.document.kind !== "page") throw new Error("missing page draft");
  return draft.document.definition;
}

describe("demo studio port", () => {
  it("lists seeded boards, pages and components", async () => {
    const { studio } = setup();
    const boards = await studio.list({ kind: "board", search: null, cursor: null, limit: 50 });
    const pages = await studio.list({ kind: "page", search: null, cursor: null, limit: 50 });
    const components = await studio.list({
      kind: "component",
      search: null,
      cursor: null,
      limit: 50,
    });
    expect(boards.items.length).toBe(3);
    expect(pages.items.map((page) => page.slug)).toContain("duty-officer");
    expect(components.items[0]?.name).toBe("Shelter capacity gauge");
  });

  it("walks create, saveDraft, publish, rollback with per-definition versions", async () => {
    const { studio } = setup();
    const created = await createPage(studio, "lifecycle_page");
    expect(created.version).toBe(1);
    const definition = await draftPage(studio, created.id);

    const saved = await studio.saveDraft({
      id: created.id,
      baseVersion: 1,
      document: { kind: "page", definition: { ...definition, title: "Edited once" } },
    });
    expect(saved.version).toBe(1);

    const first = await studio.publish({
      kind: "page",
      id: created.id,
      expectedVersion: 1,
      changeSummary: "First publish",
      idempotencyKey: idem(),
    });
    expect(first.version).toBe(1);
    expect(await studio.get({ kind: "page", id: created.id, revision: "draft" })).toBeNull();

    // A new draft after publishing is published + 1.
    const second = await studio.saveDraft({
      id: created.id,
      baseVersion: 1,
      document: { kind: "page", definition: { ...definition, title: "Edited twice" } },
    });
    expect(second.version).toBe(2);
    await studio.publish({
      kind: "page",
      id: created.id,
      expectedVersion: 2,
      changeSummary: "Second publish",
      idempotencyKey: idem(),
    });

    const rolled = await studio.rollback({
      kind: "page",
      id: created.id,
      expectedPublishedVersion: 2,
      restoreVersion: 1,
      changeSummary: "Back to first",
      idempotencyKey: idem(),
    });
    expect(rolled.version).toBe(3);

    const versions = await studio.listVersions({ kind: "page", id: created.id });
    expect(versions.map((v) => [v.version, v.lifecycle])).toEqual([
      [3, "published"],
      [2, "archived"],
      [1, "archived"],
    ]);
    const live = await studio.get({ kind: "page", id: created.id, revision: "published" });
    if (live?.document.kind !== "page") throw new Error("missing published");
    expect(live.document.definition.title).toBe("Edited once");
    expect(rolled.auditEventId).not.toBe(first.auditEventId);
  });

  it("rejects stale versions with definition-version-conflict", async () => {
    const { studio } = setup();
    const created = await createPage(studio, "conflict_page");
    const definition = await draftPage(studio, created.id);
    await expect(
      studio.saveDraft({
        id: created.id,
        baseVersion: 7,
        document: { kind: "page", definition },
      }),
    ).rejects.toThrow(/^definition-version-conflict/);
    await expect(
      studio.publish({
        kind: "page",
        id: created.id,
        expectedVersion: 9,
        changeSummary: "nope",
        idempotencyKey: idem(),
      }),
    ).rejects.toThrow(/^definition-version-conflict/);
  });

  it("replays the original result for the same idempotency key", async () => {
    const { studio } = setup();
    const input = {
      kind: "page" as const,
      key: "idem_page",
      name: "Idem",
      template: { type: "blank" as const },
      idempotencyKey: idem(),
    };
    const first = await studio.create(input);
    expect(await studio.create(input)).toEqual(first);
    const pages = await studio.list({ kind: "page", search: "idem", cursor: null, limit: 50 });
    expect(pages.items).toHaveLength(1);

    const publishInput = {
      kind: "page" as const,
      id: first.id,
      expectedVersion: 1,
      changeSummary: "Publish",
      idempotencyKey: idem(),
    };
    const a = await studio.publish(publishInput);
    expect(await studio.publish(publishInput)).toEqual(a);
  });

  it("getPageBySlug returns published pages only", async () => {
    const { studio } = setup();
    expect(await studio.getPageBySlug({ slug: "duty-officer" })).not.toBeNull();
    expect(await studio.getPageBySlug({ slug: "end-of-period-briefing" })).toBeNull();
    const created = await createPage(studio, "slug_probe");
    expect(await studio.getPageBySlug({ slug: "slug-probe" })).toBeNull();
    await studio.publish({
      kind: "page",
      id: created.id,
      expectedVersion: 1,
      changeSummary: "Go live",
      idempotencyKey: idem(),
    });
    expect((await studio.getPageBySlug({ slug: "slug-probe" }))?.version).toBe(1);
  });

  it("validate reports schema and reference issues with paths", async () => {
    const { studio } = setup();
    const created = await createPage(studio, "validate_page");
    const definition = await draftPage(studio, created.id);

    const clean = await studio.validate({ document: { kind: "page", definition } });
    expect(clean.issues).toEqual([]);

    const dangling = await studio.validate({
      document: {
        kind: "page",
        definition: {
          ...definition,
          layouts: [
            {
              breakpoint: "desktop",
              items: [
                {
                  blockId: "9c000000-0000-4000-8000-0000000000ff",
                  x: 0,
                  y: 0,
                  width: 4,
                  height: 2,
                  hidden: false,
                },
              ],
            },
          ],
        },
      },
    });
    expect(dangling.issues.some((issue) => issue.path.includes("blockId"))).toBe(true);

    const missingComponent = await studio.validate({
      document: {
        kind: "page",
        definition: {
          ...definition,
          blocks: [
            {
              id: "9c000000-0000-4000-8000-0000000000aa",
              type: "custom-component",
              name: "Gauge",
              config: {
                componentId: DEMO_COMPONENTS.shelterCapacityGauge,
                componentVersion: 42,
                props: {},
              },
              visibilityExpression: null,
              action: null,
              access: { positionIds: [], visibilityRule: null },
            },
          ],
          layouts: [{ breakpoint: "desktop", items: [] }],
        },
      },
    });
    expect(missingComponent.issues).toEqual([
      expect.objectContaining({
        path: ["definition", "blocks", 0, "config", "componentVersion"],
        severity: "error",
      }),
    ]);

    const slugClash = await studio.validate({
      document: { kind: "page", definition: { ...definition, slug: "duty-officer" } },
    });
    expect(slugClash.issues.map((issue) => issue.path)).toContainEqual(["definition", "slug"]);
  });

  it("creates from-table, duplicate and eject-block templates that validate", async () => {
    const { studio } = setup();
    const board = await studio.create({
      kind: "board",
      key: "shelter_table_board",
      name: "Shelter table board",
      template: { type: "from-table", tableId: DEMO_TABLES.shelters },
      idempotencyKey: idem(),
    });
    const copy = await studio.create({
      kind: "page",
      key: "duty_copy",
      name: "Duty copy",
      template: { type: "duplicate", sourceId: DEMO_PAGES.dutyOfficer },
      idempotencyKey: idem(),
    });
    const ejected = await studio.create({
      kind: "component",
      key: "ejected_stat",
      name: "Ejected stat",
      template: { type: "eject-block", blockType: "stat" },
      idempotencyKey: idem(),
    });
    for (const [kind, id] of [
      ["board", board.id],
      ["page", copy.id],
      ["component", ejected.id],
    ] as const) {
      const got = await studio.get({ kind, id, revision: "draft" });
      if (!got) throw new Error(`missing ${kind} draft`);
      expect(got.version).toBe(1);
      const document: StudioDocument = got.document;
      expect((await studio.validate({ document })).issues).toEqual([]);
    }
  });

  it("enforces studio permissions per position", async () => {
    const { session, studio } = setup();
    await session.selectPosition({ positionId: DEMO_POSITIONS.shelterManager });
    await expect(
      studio.list({ kind: "page", search: null, cursor: null, limit: 10 }),
    ).rejects.toThrow(/^forbidden/);

    await session.selectPosition({ positionId: DEMO_POSITIONS.planningChief });
    const pages = await studio.list({ kind: "page", search: null, cursor: null, limit: 10 });
    expect(pages.items[0]?.permissions).toEqual({
      view: true,
      edit: true,
      publish: false,
      editCode: false,
    });
    await expect(
      studio.publish({
        kind: "page",
        id: DEMO_PAGES.draftOnly,
        expectedVersion: 1,
        changeSummary: "Not allowed",
        idempotencyKey: idem(),
      }),
    ).rejects.toThrow(/^forbidden/);
  });
});
