import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { validateDefinitionText } from "../studio/code-view.js";
import { builderReducer, createBuilderState } from "./builder-state.js";
import {
  blockCodeSchema,
  boardBundleCodeSchema,
  ejectBlockToComponent,
  replaceBlock,
  replaceBundle,
  resolveCodeAccess,
  validateBlockSemantics,
  validateBundleSemantics,
} from "./code-mode.js";
import { BlockPicker, ModeSwitch } from "./code-panes.js";
import { addBlock } from "./draft.js";
import { createExpressionValidationStub } from "./expression.js";
import { Inspector } from "./inspector.js";
import type { BoardBundle } from "./model.js";

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BLOCK_ID = id(500);

/** FIXTURE DATA for tests only. */
function fixture(): BoardBundle {
  const meta = {
    version: 1,
    lifecycle: "published" as const,
    changeSummary: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: id(2),
    createdPositionId: id(3),
    publishedAt: "2026-01-01T00:00:00.000Z",
    publishedBy: id(2),
    tenantId: id(1),
  };
  const empty: BoardBundle = {
    definition: {
      ...meta,
      id: id(10),
      key: "fixture_board",
      name: "Fixture board",
      description: null,
      dataSources: [{ alias: "main", tableId: id(13), filterExpression: null }],
      views: [
        {
          id: id(14),
          viewId: id(14),
          name: "All",
          access: { positionIds: [], visibilityRule: null },
        },
      ],
      blocks: [],
      layoutId: id(11),
      access: { positionIds: [], visibilityRule: null },
    },
    layout: {
      ...meta,
      id: id(11),
      name: "Fixture layout",
      boardId: id(10),
      positionId: null,
      columns: 12,
      layouts: [{ breakpoint: "desktop", items: [] }],
    },
  };
  return addBlock(empty, "stat", "Open incidents", BLOCK_ID);
}

const at = 1_000_000;

describe("bundle code replace", () => {
  it("accepts the unchanged fixture through the schema and semantic checks", () => {
    const bundle = fixture();
    const result = validateDefinitionText(JSON.stringify(bundle), boardBundleCodeSchema, (next) =>
      validateBundleSemantics(next as unknown as BoardBundle, bundle),
    );
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("records ONE history entry when a valid replacement is applied", () => {
    const bundle = fixture();
    const next: BoardBundle = {
      ...bundle,
      definition: { ...bundle.definition, name: "Renamed in code" },
    };
    const result = replaceBundle(bundle, next);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = builderReducer(createBuilderState(bundle), {
      type: "edit",
      next: result.bundle,
      at,
    });
    expect(state.history.past).toHaveLength(1);
    expect(state.history.present.definition.name).toBe("Renamed in code");
    expect(builderReducer(state, { type: "undo" }).history.present).toBe(bundle);
  });

  it("refuses bundles with layout items for missing blocks, duplicate ids and out-of-grid items", () => {
    const bundle = fixture();
    const item = bundle.layout.layouts[0]?.items[0];
    if (!item) throw new Error("fixture has no layout item");
    const bad: BoardBundle = {
      definition: {
        ...bundle.definition,
        blocks: [...bundle.definition.blocks, ...bundle.definition.blocks],
      },
      layout: {
        ...bundle.layout,
        layouts: [
          {
            breakpoint: "desktop",
            items: [
              { ...item, x: 10, width: 6 },
              { ...item, blockId: id(999), x: 0, y: 20 },
            ],
          },
        ],
      },
    };
    const messages = validateBundleSemantics(bad, bundle)
      .map((i) => i.message)
      .join("\n");
    expect(messages).toContain("Duplicate block id");
    expect(messages).toContain("missing block");
    expect(messages).toContain("12-column grid");
    expect(replaceBundle(bundle, bad).ok).toBe(false);
  });

  it("never reaches the draft: invalid text yields no value and the state is untouched", () => {
    const bundle = fixture();
    const initial = createBuilderState(bundle);
    const result = validateDefinitionText("{ not json", boardBundleCodeSchema);
    expect(result.ok).toBe(false);
    expect("value" in result).toBe(false);
    expect(initial.history.past).toHaveLength(0);
  });

  it("rejects changing the board id, tenant, version or layout id", () => {
    const bundle = fixture();
    const changed: BoardBundle = {
      definition: { ...bundle.definition, id: id(77), tenantId: id(78), version: 9 },
      layout: { ...bundle.layout, id: id(79) },
    };
    const paths = validateBundleSemantics(changed, bundle).map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["definition.id", "definition.tenantId", "definition.version"]),
    );
    expect(replaceBundle(bundle, changed).ok).toBe(false);
  });

  it("a no-op replacement adds no undo step", () => {
    const bundle = fixture();
    const copy = JSON.parse(JSON.stringify(bundle)) as BoardBundle;
    const state = builderReducer(createBuilderState(bundle), { type: "edit", next: copy, at });
    expect(state.history.past).toHaveLength(0);
  });
});

describe("block code replace", () => {
  it("replaces one block in a single undo step", () => {
    const bundle = fixture();
    const block = bundle.definition.blocks[0];
    if (!block) throw new Error("no block");
    const result = replaceBlock(bundle, BLOCK_ID, { ...block, name: "Edited in code" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = builderReducer(createBuilderState(bundle), {
      type: "edit",
      next: result.bundle,
      at,
    });
    expect(state.history.past).toHaveLength(1);
    expect(state.history.present.definition.blocks[0]?.name).toBe("Edited in code");
    expect(state.history.present.layout).toBe(bundle.layout);
  });

  it("rejects a changed block id and leaves the bundle alone", () => {
    const bundle = fixture();
    const block = bundle.definition.blocks[0];
    if (!block) throw new Error("no block");
    const renamed = { ...block, id: id(501) };
    expect(validateBlockSemantics(renamed, BLOCK_ID)[0]?.severity).toBe("error");
    const viaText = validateDefinitionText(JSON.stringify(renamed), blockCodeSchema, (next) =>
      validateBlockSemantics(next as unknown as typeof renamed, BLOCK_ID),
    );
    expect(viaText.ok).toBe(false);
    expect(replaceBlock(bundle, BLOCK_ID, renamed).ok).toBe(false);
  });

  it("refuses to replace a block that no longer exists", () => {
    const bundle = fixture();
    const block = bundle.definition.blocks[0];
    if (!block) throw new Error("no block");
    expect(replaceBlock(bundle, id(404), { ...block, id: id(404) }).ok).toBe(false);
  });
});

describe("eject to custom component", () => {
  it("keeps id, name and layout and swaps type and config", () => {
    const bundle = fixture();
    const next = ejectBlockToComponent(bundle, BLOCK_ID, {
      componentId: id(900),
      componentVersion: 3,
    });
    expect(next.definition.blocks[0]).toMatchObject({
      id: BLOCK_ID,
      name: "Open incidents",
      type: "custom-component",
      config: { componentId: id(900), componentVersion: 3, props: {} },
    });
    expect(next.layout).toBe(bundle.layout);
    const state = builderReducer(createBuilderState(bundle), { type: "edit", next, at });
    expect(state.history.past).toHaveLength(1);
  });

  it("leaves custom-component blocks and unknown ids untouched", () => {
    const bundle = fixture();
    const once = ejectBlockToComponent(bundle, BLOCK_ID, {
      componentId: id(900),
      componentVersion: 1,
    });
    expect(
      ejectBlockToComponent(once, BLOCK_ID, { componentId: id(901), componentVersion: 2 }),
    ).toBe(once);
    expect(
      ejectBlockToComponent(bundle, id(404), { componentId: id(900), componentVersion: 1 }),
    ).toBe(bundle);
  });
});

describe("code access gating", () => {
  const base = { devModeEnabled: true, editDefinitions: true, editCode: true, boardEdit: true };

  it("is hidden outside dev mode", () => {
    expect(resolveCodeAccess({ ...base, devModeEnabled: false })).toEqual({
      visible: false,
      editable: false,
      canEject: false,
    });
  });

  it("is read-only without editCode (visual builder stays usable)", () => {
    expect(resolveCodeAccess({ ...base, editCode: false })).toEqual({
      visible: true,
      editable: false,
      canEject: false,
    });
  });

  it("the per-board edit permission is an additional restriction", () => {
    expect(resolveCodeAccess({ ...base, boardEdit: false }).editable).toBe(false);
    expect(resolveCodeAccess({ ...base, boardEdit: undefined }).editable).toBe(true);
  });

  it("allows eject only when editable and the position can edit definitions", () => {
    expect(resolveCodeAccess(base).canEject).toBe(true);
    expect(resolveCodeAccess({ ...base, editDefinitions: false }).canEject).toBe(false);
  });
});

describe("builder code UI (server render)", () => {
  const bundle = fixture();
  const props = {
    bundle,
    block: bundle.definition.blocks[0],
    item: bundle.layout.layouts[0]?.items[0],
    breakpoint: "desktop" as const,
    validator: createExpressionValidationStub(),
    displayName: "Stat",
    onEdit: () => undefined,
  };

  it("renders the mode switch as a labelled radio group with one checked option", () => {
    const html = renderToStaticMarkup(<ModeSwitch value="code" onChange={() => undefined} />);
    expect(html).toContain('aria-label="Builder mode"');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it("shows Settings and Code tabs only when the code prop is passed", () => {
    expect(renderToStaticMarkup(<Inspector {...props} />)).not.toContain('role="tab"');
    const html = renderToStaticMarkup(<Inspector {...props} code={{ editable: false }} />);
    expect(html).toContain("Settings");
    expect(html).toContain('role="tab"');
  });

  it("renders Customize code only when a handler is given, and not for custom components", () => {
    expect(renderToStaticMarkup(<Inspector {...props} />)).not.toContain("Customize code");
    const withHandler = renderToStaticMarkup(
      <Inspector {...props} onEjectBlock={() => Promise.resolve(null)} />,
    );
    expect(withHandler).toContain("Customize code");
    const ejected = ejectBlockToComponent(bundle, BLOCK_ID, {
      componentId: id(900),
      componentVersion: 1,
    });
    const custom = renderToStaticMarkup(
      <Inspector
        {...props}
        bundle={ejected}
        block={ejected.definition.blocks[0]}
        onEjectBlock={() => Promise.resolve(null)}
      />,
    );
    expect(custom).not.toContain("Customize code");
  });

  it("lists blocks for code mode selection", () => {
    const html = renderToStaticMarkup(
      <BlockPicker
        blocks={bundle.definition.blocks}
        selectedId={BLOCK_ID}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("Open incidents");
    expect(html).toContain('aria-pressed="true"');
  });
});
