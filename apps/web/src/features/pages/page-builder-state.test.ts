import { describe, expect, it } from "vitest";
import {
  canRedoPage,
  canUndoPage,
  createPageBuilderState,
  isPageDirty,
  pageBuilderReducer,
} from "./page-builder-state.js";
import { makePageFixture } from "./test-fixtures.js";

describe("page builder reducer", () => {
  const page = makePageFixture();
  const noBlocks = {
    ...page,
    blocks: [],
    layouts: [{ breakpoint: "desktop" as const, items: [] }],
  };

  it("starts clean and records edits as undoable steps", () => {
    let state = createPageBuilderState(page);
    expect(isPageDirty(state)).toBe(false);
    state = pageBuilderReducer(state, { type: "edit", next: { ...page, title: "A" }, at: 0 });
    expect(isPageDirty(state)).toBe(true);
    expect(canUndoPage(state)).toBe(true);
    state = pageBuilderReducer(state, { type: "undo" });
    expect(state.history.present.title).toBe(page.title);
    expect(isPageDirty(state)).toBe(false);
    expect(canRedoPage(state)).toBe(true);
  });

  it("coalesces keyed edits inside the window into one undo step", () => {
    let state = createPageBuilderState(page);
    state = pageBuilderReducer(state, {
      type: "edit",
      next: { ...page, title: "A" },
      at: 0,
      key: "t",
    });
    state = pageBuilderReducer(state, {
      type: "edit",
      next: { ...page, title: "AB" },
      at: 100,
      key: "t",
    });
    state = pageBuilderReducer(state, { type: "undo" });
    expect(state.history.present.title).toBe(page.title);
  });

  it("applies a whole-page code edit as a single undo step", () => {
    let state = createPageBuilderState(page);
    state = pageBuilderReducer(state, {
      type: "edit",
      next: { ...noBlocks, title: "Code", slug: "code" },
      at: 0,
    });
    state = pageBuilderReducer(state, { type: "undo" });
    expect(state.history.present).toEqual(page);
  });

  it("drops the selection of removed blocks and tracks saves", () => {
    const blockId = page.blocks[0]?.id ?? "";
    let state = createPageBuilderState(page);
    state = pageBuilderReducer(state, { type: "select", id: blockId });
    state = pageBuilderReducer(state, { type: "edit", next: noBlocks, at: 0 });
    expect(state.selectedId).toBeNull();
    state = pageBuilderReducer(state, { type: "saved", version: 4, page: state.history.present });
    expect(state.baseVersion).toBe(4);
    expect(isPageDirty(state)).toBe(false);
  });
});
