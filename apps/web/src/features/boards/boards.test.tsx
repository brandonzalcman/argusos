import { coreBlockRegistry } from "@argus/blocks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardGrid } from "./board-renderer.js";
import { filterBoards } from "./boards-list-page.js";
import { builderReducer, createBuilderState, isDirty } from "./builder-state.js";
import { copyBlocks, pasteBlocks } from "./clipboard.js";
import { validateConfig } from "./config-schema.js";
import { diffBoards } from "./diff.js";
import { addBlock, moveBlockTo, nudgeBlock, removeBlock, setBlockHidden } from "./draft.js";
import {
  type ConditionGroup,
  celStringLiteral,
  compileCondition,
  parseCondition,
} from "./expression.js";
import { commit, createHistory, redo, undo } from "./history.js";
import {
  blockSizes,
  breakpointForWidth,
  collapseEmptyRows,
  layoutFor,
  moveGroup,
  overlaps,
  placeItem,
  resolveBreakpointItems,
  stackItems,
  validateItems,
} from "./layout-ops.js";
import type { BoardBundle, LayoutItem } from "./model.js";
import { createBoardDataPortStubForTests } from "./test-fixtures.js";

/**
 * FIXTURE DATA — used only by these tests. Never imported by production code.
 */
const ids = {
  tenant: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  position: "00000000-0000-4000-8000-000000000003",
  board: "00000000-0000-4000-8000-000000000010",
  layout: "00000000-0000-4000-8000-000000000011",
  source: "00000000-0000-4000-8000-000000000012",
  table: "00000000-0000-4000-8000-000000000013",
  view: "00000000-0000-4000-8000-000000000014",
};

function fixtureBundle(): BoardBundle {
  const meta = {
    version: 1,
    lifecycle: "published" as const,
    changeSummary: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: ids.user,
    createdPositionId: ids.position,
    publishedAt: "2026-01-01T00:00:00.000Z",
    publishedBy: ids.user,
    tenantId: ids.tenant,
  };
  return {
    definition: {
      ...meta,
      id: ids.board,
      key: "fixture-board",
      name: "Fixture board",
      description: null,
      dataSources: [{ alias: "main", tableId: ids.table, filterExpression: null }],
      views: [
        {
          id: ids.view,
          viewId: ids.view,
          name: "All",
          access: { positionIds: [], visibilityRule: null },
        },
      ],
      blocks: [],
      layoutId: ids.layout,
      access: { positionIds: [], visibilityRule: null },
    },
    layout: {
      ...meta,
      id: ids.layout,
      name: "Fixture layout",
      boardId: ids.board,
      positionId: null,
      columns: 12,
      layouts: [{ breakpoint: "desktop", items: [] }],
    },
  };
}

let counter = 100;
const nextId = (): string => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`;

describe("layout operations", () => {
  const kindOf = () => "stat" as const;
  const item = (id: string, x: number, y: number, w: number, h: number): LayoutItem => ({
    blockId: id,
    x,
    y,
    width: w,
    height: h,
    hidden: false,
  });

  it("clamps moves inside the 12-column grid and enforces minimum size", () => {
    const placed = placeItem(
      [item("a", 0, 0, 3, 2)],
      "a",
      { x: 20, y: -4, width: 1, height: 1 },
      kindOf,
    );
    expect(placed[0]).toMatchObject({ x: 10, y: 0, width: 2, height: 2 });
  });

  it("pushes colliding blocks down and never leaves overlaps", () => {
    const placed = placeItem(
      [item("a", 0, 0, 4, 2), item("b", 4, 0, 4, 2)],
      "b",
      { x: 0, y: 0, width: 4, height: 2 },
      kindOf,
    );
    const a = placed.find((i) => i.blockId === "a");
    const b = placed.find((i) => i.blockId === "b");
    expect(b).toMatchObject({ x: 0, y: 0 });
    expect(a && b && overlaps(a, b)).toBe(false);
    expect(validateItems(placed, new Set(["a", "b"]))).toEqual([]);
  });

  it("ignores hidden items for collisions", () => {
    const hidden = { ...item("a", 0, 0, 4, 2), hidden: true };
    const placed = placeItem(
      [hidden, item("b", 4, 0, 4, 2)],
      "b",
      { x: 0, y: 0, width: 4, height: 2 },
      kindOf,
    );
    expect(placed.find((i) => i.blockId === "a")?.y).toBe(0);
  });

  it("reports collisions, duplicates, unknown ids and bounds", () => {
    const problems = validateItems(
      [item("a", 0, 0, 4, 2), item("a", 2, 0, 4, 2), item("z", 10, 0, 4, 1)],
      new Set(["a"]),
    );
    expect(problems.map((p) => p.code).toSorted()).toEqual([
      "collision",
      "duplicate-block",
      "out-of-bounds",
      "unknown-block",
    ]);
  });

  it("selects breakpoints by width with desktop fallback and stacks phones in reading order", () => {
    expect(breakpointForWidth(390)).toBe("phone");
    expect(breakpointForWidth(800)).toBe("tablet");
    expect(breakpointForWidth(1400)).toBe("desktop");
    expect(breakpointForWidth(3000)).toBe("video-wall");
    const layout = fixtureBundle().layout;
    expect(resolveBreakpointItems(layout, "phone").breakpoint).toBe("desktop");
    const stacked = stackItems([item("b", 6, 1, 3, 1), item("a", 0, 0, 3, 1)]);
    expect(stacked.map((i) => i.blockId)).toEqual(["a", "b"]);
    expect(stacked.every((i) => i.x === 0 && i.width === 12)).toBe(true);
  });

  it("defines a footprint for every registered block kind", () => {
    for (const module of coreBlockRegistry.list()) {
      expect(blockSizes[module.kind].w).toBeGreaterThanOrEqual(blockSizes[module.kind].minW);
    }
  });
});

describe("draft edits", () => {
  it("adds, moves, nudges, hides and removes blocks across breakpoints", () => {
    const id = nextId();
    let bundle = addBlock(fixtureBundle(), "stat", "KPI", id);
    expect(bundle.definition.blocks).toHaveLength(1);
    expect(layoutFor(bundle.layout, "desktop")).toHaveLength(1);

    bundle = moveBlockTo(bundle, "desktop", id, { x: 5, y: 3, width: 3, height: 2 });
    expect(layoutFor(bundle.layout, "desktop")[0]).toMatchObject({ x: 5, y: 3 });
    bundle = nudgeBlock(bundle, "desktop", id, { dx: 1, dh: 1 });
    expect(layoutFor(bundle.layout, "desktop")[0]).toMatchObject({ x: 6, height: 3 });
    bundle = setBlockHidden(bundle, "desktop", id, true);
    expect(layoutFor(bundle.layout, "desktop")[0]?.hidden).toBe(true);

    bundle = removeBlock(bundle, id);
    expect(bundle.definition.blocks).toHaveLength(0);
    expect(layoutFor(bundle.layout, "desktop")).toHaveLength(0);
  });

  it("does not mutate the input bundle", () => {
    const before = fixtureBundle();
    const snapshot = JSON.stringify(before);
    addBlock(before, "divider", "Divider", nextId());
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("history and builder reducer", () => {
  it("supports undo, redo and clears redo on a new edit", () => {
    let history = createHistory(1);
    history = commit(history, 2);
    history = commit(history, 3);
    history = undo(history);
    expect(history.present).toBe(2);
    history = redo(history);
    expect(history.present).toBe(3);
    history = undo(undo(history));
    history = commit(history, 9);
    expect(history.future).toEqual([]);
  });

  it("coalesces rapid same-key edits into one undo step and tracks dirtiness", () => {
    const base = fixtureBundle();
    let state = createBuilderState(base);
    const id = nextId();
    state = builderReducer(state, { type: "edit", next: addBlock(base, "stat", "KPI", id), at: 0 });
    const withName = (name: string): BoardBundle => ({
      ...state.history.present,
      definition: { ...state.history.present.definition, name },
    });
    state = builderReducer(state, { type: "edit", next: withName("A"), at: 10, key: "n" });
    state = builderReducer(state, { type: "edit", next: withName("AB"), at: 20, key: "n" });
    expect(isDirty(state)).toBe(true);
    expect(state.history.past).toHaveLength(2);
    state = builderReducer(state, { type: "undo" });
    expect(state.history.present.definition.name).toBe("Fixture board");
    state = builderReducer(state, { type: "redo" });
    expect(state.history.present.definition.name).toBe("AB");
    state = builderReducer(state, { type: "saved", version: 2, bundle: state.history.present });
    expect(isDirty(state)).toBe(false);
    expect(state.baseVersion).toBe(2);
  });
});

describe("block config descriptors", () => {
  it("flags missing required configuration and out-of-range numbers", () => {
    expect(validateConfig("record-list", {}).map((i) => i.key)).toContain("tableId");
    expect(validateConfig("record-list", { tableId: ids.table, pageSize: 5000 })[0]?.key).toBe(
      "pageSize",
    );
    expect(validateConfig("record-list", { tableId: ids.table, pageSize: 25 })).toEqual([]);
  });

  it("only accepts an exact https origin for embeds", () => {
    const base = { embedDefinitionId: "x" };
    expect(validateConfig("embed", { ...base, allowlistedOrigin: "http://a.org" })).not.toEqual([]);
    expect(
      validateConfig("embed", { ...base, allowlistedOrigin: "https://a.org/path" }),
    ).not.toEqual([]);
    expect(validateConfig("embed", { ...base, allowlistedOrigin: "https://a.org" })).toEqual([]);
  });
});

describe("condition editor model", () => {
  it("escapes string values so they cannot break out of the CEL literal", () => {
    expect(celStringLiteral('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    const result = compileCondition({
      joiner: "&&",
      rows: [{ path: "record.name", operator: "==", valueType: "string", value: '" || true || "' }],
    });
    expect(result.ok && result.source).toBe('record.name == "\\" || true || \\""');
  });

  it("rejects injected field paths and bad numbers", () => {
    const result = compileCondition({
      joiner: "&&",
      rows: [
        { path: "record.x || true", operator: "==", valueType: "number", value: "1" },
        { path: "record.y", operator: "==", valueType: "number", value: "1; drop" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("round-trips generated expressions", () => {
    const group: ConditionGroup = {
      joiner: "||",
      rows: [
        { path: "record.priority", operator: "==", valueType: "string", value: 'Crit "x"' },
        { path: "incident.level", operator: ">=", valueType: "number", value: "3" },
        { path: "record.open", operator: "!=", valueType: "boolean", value: "false" },
        { path: "record.note", operator: "==", valueType: "null", value: "" },
      ],
    };
    const compiled = compileCondition(group);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(parseCondition(compiled.source)).toEqual(group);
  });

  it("falls back to raw editing for CEL it did not generate", () => {
    expect(parseCondition("record.a == 1 && (record.b == 2 || record.c == 3)")).toBeNull();
    expect(parseCondition("record.a == 1 && record.b == 2 || record.c == 3")).toBeNull();
  });
});

describe("board diff", () => {
  it("compares by stable block identity: added, removed, changed and layout moves", () => {
    const a = nextId();
    const b = nextId();
    const base = addBlock(addBlock(fixtureBundle(), "stat", "KPI", a), "divider", "Line", b);
    let head = removeBlock(base, b);
    head = moveBlockTo(head, "desktop", a, { x: 4, y: 0, width: 3, height: 2 });
    head = {
      ...head,
      definition: {
        ...head.definition,
        blocks: head.definition.blocks.map((blk) =>
          blk.id === a ? { ...blk, name: "Renamed", config: { label: "New" } } : blk,
        ),
      },
    };
    const c = nextId();
    head = addBlock(head, "button", "Go", c);

    const diff = diffBoards(base, head);
    expect(diff.added.map((blk) => blk.id)).toEqual([c]);
    expect(diff.removed.map((blk) => blk.id)).toEqual([b]);
    expect(diff.changed[0]?.changes.map((ch) => ch.path)).toEqual(["name", "config.label"]);
    const kinds = diff.layout[0]?.changes.map((ch) => `${ch.kind}:${ch.blockId}`);
    expect(kinds).toContain(`moved:${a}`);
    expect(kinds).toContain(`added:${c}`);
    expect(kinds).toContain(`removed:${b}`);
    expect(diffBoards(base, base).isEmpty).toBe(true);
  });
});

describe("boards list", () => {
  it("filters authorized boards by name, key and description", () => {
    const board = (name: string, key: string) => ({
      id: name,
      key,
      name,
      description: null,
      publishedVersion: 1,
      draftVersion: null,
      publishedAt: null,
      blockCount: 0,
      permissions: { view: true, edit: false, publish: false },
    });
    const boards = [board("Sit Rep", "sitrep"), board("Resources", "res-requests")];
    expect(filterBoards(boards, " sit ")).toHaveLength(1);
    expect(filterBoards(boards, "REQUESTS")).toHaveLength(1);
    expect(filterBoards(boards, "")).toHaveLength(2);
  });
});

describe("runtime grid rendering (server-rendered, fixture data)", () => {
  function render(bundle: BoardBundle): string {
    const client = new QueryClient();
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <BoardGrid
          definition={bundle.definition}
          layout={bundle.layout}
          registry={coreBlockRegistry}
          breakpoint="desktop"
          data={createBoardDataPortStubForTests()}
          context={{
            scope: {
              tenantId: ids.tenant,
              userId: ids.user,
              positionId: ids.position,
              incidentId: null,
              requestId: ids.view,
              authenticatedAt: "2026-01-01T00:00:00.000Z",
            },
            boardId: ids.board,
            definitionVersion: 1,
            mode: "runtime",
          }}
        />
      </QueryClientProvider>,
    );
  }

  it("renders an empty-board state without blocks", () => {
    expect(render(fixtureBundle())).toContain("no visible blocks");
  });

  it("shows a not-configured error for incomplete blocks instead of fake data", () => {
    const bundle = addBlock(fixtureBundle(), "record-list", "Records", nextId());
    const html = render(bundle);
    expect(html).toContain("Not configured");
    expect(html).toContain("Table is required.");
  });

  it("shows a loading skeleton for a configured data block", () => {
    let bundle = addBlock(fixtureBundle(), "record-list", "Records", nextId());
    bundle = {
      ...bundle,
      definition: {
        ...bundle.definition,
        blocks: bundle.definition.blocks.map((blk) => ({
          ...blk,
          config: { ...blk.config, tableId: ids.table },
        })),
      },
    };
    expect(render(bundle)).toContain("Loading Records");
  });

  it("fails closed for blocks with a visibility condition", () => {
    const id = nextId();
    let bundle = addBlock(fixtureBundle(), "divider", "Line", id);
    bundle = {
      ...bundle,
      definition: {
        ...bundle.definition,
        blocks: bundle.definition.blocks.map((blk) => ({
          ...blk,
          visibilityExpression: 'record.priority == "Critical"',
        })),
      },
    };
    const html = render(bundle);
    expect(html).toContain("hidden because its visibility condition cannot be evaluated");
    expect(html).not.toContain('data-block-kind="divider"');
  });
});

describe("multi-select, group move and clipboard", () => {
  const item = (id: string, x: number, y: number, w: number, h: number): LayoutItem => ({
    blockId: id,
    x,
    y,
    width: w,
    height: h,
    hidden: false,
  });

  it("moves a group together, clamps to the grid and pushes others down", () => {
    const moved = moveGroup(
      [item("a", 0, 0, 4, 2), item("b", 4, 0, 4, 2), item("c", 0, 2, 12, 2)],
      new Set(["a", "b"]),
      20,
      2,
    );
    const a = moved.find((i) => i.blockId === "a");
    const b = moved.find((i) => i.blockId === "b");
    const c = moved.find((i) => i.blockId === "c");
    expect(a).toMatchObject({ x: 4, y: 2 });
    expect(b).toMatchObject({ x: 8, y: 2 });
    expect(c?.y).toBeGreaterThanOrEqual(4);
  });

  it("copies blocks and pastes them with new ids below the layout, remapping tabs", () => {
    const a = nextId();
    const t = nextId();
    let bundle = addBlock(fixtureBundle(), "stat", "KPI", a);
    bundle = addBlock(bundle, "tabs", "Tabs", t);
    bundle = {
      ...bundle,
      definition: {
        ...bundle.definition,
        blocks: bundle.definition.blocks.map((blk) =>
          blk.id === t
            ? { ...blk, config: { tabs: [{ id: "x", label: "X", blockIds: [a, "outside"] }] } }
            : blk.id === a
              ? { ...blk, config: { tableId: "not-on-this-board" } }
              : blk,
        ),
      },
    };
    const clip = copyBlocks(bundle, [a, t], "board-1");
    expect(clip?.blocks).toHaveLength(2);
    const result = pasteBlocks(bundle, clip as NonNullable<typeof clip>, nextId);
    expect(result.newIds).toHaveLength(2);
    expect(new Set([...bundle.definition.blocks.map((b) => b.id), ...result.newIds]).size).toBe(4);
    const pastedTabs = result.bundle.definition.blocks.find(
      (b) => b.id !== t && b.type === "tabs" && result.newIds.includes(b.id),
    );
    const tabs = pastedTabs?.config.tabs as { blockIds: string[] }[];
    expect(tabs[0]?.blockIds).toHaveLength(1);
    expect(tabs[0]?.blockIds[0]).not.toBe(a);
    expect(result.warnings.some((w) => w.includes("not a data source"))).toBe(true);
    const items = layoutFor(result.bundle.layout, "desktop");
    expect(validateItems(items, new Set(result.bundle.definition.blocks.map((b) => b.id)))).toEqual(
      [],
    );
  });

  it("tracks multi-selection in the builder reducer", () => {
    let state = createBuilderState(fixtureBundle());
    state = builderReducer(state, { type: "select", id: "a" });
    state = builderReducer(state, { type: "select", id: "b", toggle: true });
    expect(state.selectedIds).toEqual(["a", "b"]);
    expect(state.selectedId).toBe("b");
    state = builderReducer(state, { type: "select", id: "b", toggle: true });
    expect(state.selectedIds).toEqual(["a"]);
    state = builderReducer(state, { type: "select", id: null });
    expect(state.selectedIds).toEqual([]);
  });
});

describe("runtime row compaction", () => {
  it("removes empty row bands but keeps relative layout", () => {
    const mk = (id: string, y: number, h: number): LayoutItem => ({
      blockId: id,
      x: 0,
      y,
      width: 4,
      height: h,
      hidden: false,
    });
    const out = collapseEmptyRows([mk("a", 0, 2), mk("b", 10, 3), mk("c", 11, 1)]);
    expect(out.map((i) => i.y)).toEqual([0, 2, 3]);
  });
});
