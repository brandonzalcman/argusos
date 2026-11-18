import type { MenuItem } from "@argus/schema";
import { describe, expect, it } from "vitest";
import {
  checkThemeContrast,
  clampLayoutItem,
  contrastRatio,
  findLayoutOverlaps,
  flattenMenu,
  indentMenuItem,
  isSafeMenuUrl,
  moveLayoutItem,
  moveMenuItem,
  moveMenuItemRelative,
  outdentMenuItem,
  pixelsToCells,
  previewMenuForPosition,
  removeMenuItem,
  resizeLayoutItem,
} from "./definition-logic.js";

// TEST FIXTURES ONLY — synthetic menu data, never shown as operational data.
const item = (id: string, positionIds: string[] = [], children: MenuItem[] = []): MenuItem => ({
  id,
  type: "section",
  label: id,
  targetId: null,
  url: null,
  icon: null,
  positionIds,
  visibilityExpression: null,
  children,
});

describe("previewMenuForPosition", () => {
  const tree = [item("a"), item("b", ["p1"], [item("b1")]), item("c", ["p2"])];

  it("treats empty positionIds as visible to everyone", () => {
    expect(previewMenuForPosition(tree, "p9")[0]?.visible).toBe(true);
  });

  it("hides items for other positions and hides the subtree of hidden parents", () => {
    const result = previewMenuForPosition(tree, "p2");
    expect(result.map((r) => r.visible)).toEqual([true, false, true]);
    expect(result[1]?.children[0]?.visible).toBe(false);
  });

  it("hides server-denied items", () => {
    const result = previewMenuForPosition(tree, "p1", new Set(["a"]));
    expect(result[0]?.visible).toBe(false);
    expect(result[1]?.visible).toBe(true);
  });
});

describe("menu edits", () => {
  const tree = [item("a"), item("b", [], [item("b1"), item("b2")])];

  it("moves siblings at any depth and clamps at the ends", () => {
    expect(moveMenuItem(tree, "b", -1).map((i) => i.id)).toEqual(["b", "a"]);
    expect(moveMenuItem(tree, "a", -1).map((i) => i.id)).toEqual(["a", "b"]);
    expect(moveMenuItem(tree, "b2", -1)[1]?.children.map((i) => i.id)).toEqual(["b2", "b1"]);
  });

  it("removes nested items and flattens depth-first", () => {
    expect(flattenMenu(removeMenuItem(tree, "b1")).map((f) => `${f.item.id}:${f.depth}`)).toEqual([
      "a:0",
      "b:0",
      "b2:1",
    ]);
  });

  it("only allows http, https and mailto URLs", () => {
    expect(isSafeMenuUrl("https://example.org")).toBe(true);
    expect(isSafeMenuUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMenuUrl("not a url")).toBe(false);
  });
});

describe("layout overlaps", () => {
  it("finds overlapping visible blocks and ignores hidden ones", () => {
    const base = { y: 0, height: 2, hidden: false };
    expect(
      findLayoutOverlaps([
        { blockId: "a", x: 0, width: 6, ...base },
        { blockId: "b", x: 5, width: 4, ...base },
        { blockId: "c", x: 5, width: 4, ...base, hidden: true },
      ]),
    ).toEqual([["a", "b"]]);
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777", "#888")).toBeLessThan(2);
    expect(contrastRatio("red", "#fff")).toBeNull();
  });

  it("reports unmeasurable and failing pairs as not passing", () => {
    const checks = checkThemeContrast({ text: "#aaaaaa", surface: "#ffffff" });
    expect(checks.find((c) => c.foregroundKey === "text")?.pass).toBe(false);
    expect(checks.find((c) => c.foregroundKey === "accent")?.ratio).toBeNull();
  });
});

describe("menu restructuring", () => {
  const sec = (id: string, children: MenuItem[] = []): MenuItem => ({
    ...item(id, [], children),
    type: "section",
  });
  const leaf = (id: string): MenuItem => ({ ...item(id), type: "url", url: "https://example.org" });
  const ids = (items: readonly MenuItem[]): string[] =>
    flattenMenu(items).map((f) => `${f.item.id}:${f.depth}`);

  it("moves before, after and inside sections", () => {
    const tree = [sec("s", [leaf("a")]), leaf("b"), leaf("c")];
    expect(ids(moveMenuItemRelative(tree, "c", "s", "before"))).toEqual([
      "c:0",
      "s:0",
      "a:1",
      "b:0",
    ]);
    expect(ids(moveMenuItemRelative(tree, "b", "a", "after"))).toEqual([
      "s:0",
      "a:1",
      "b:1",
      "c:0",
    ]);
    expect(ids(moveMenuItemRelative(tree, "c", "s", "inside"))).toEqual([
      "s:0",
      "a:1",
      "c:1",
      "b:0",
    ]);
  });

  it("refuses moves into itself, its subtree, or a non-section", () => {
    const tree = [sec("s", [leaf("a")]), leaf("b")];
    expect(ids(moveMenuItemRelative(tree, "s", "a", "before"))).toEqual(ids(tree));
    expect(ids(moveMenuItemRelative(tree, "s", "s", "after"))).toEqual(ids(tree));
    expect(ids(moveMenuItemRelative(tree, "a", "b", "inside"))).toEqual(ids(tree));
  });

  it("indents under a preceding section and outdents after the parent", () => {
    const tree = [sec("s"), leaf("b")];
    const indented = indentMenuItem(tree, "b");
    expect(ids(indented)).toEqual(["s:0", "b:1"]);
    expect(ids(outdentMenuItem(indented, "b"))).toEqual(["s:0", "b:0"]);
    expect(ids(indentMenuItem([leaf("x"), leaf("y")], "y"))).toEqual(["x:0", "y:0"]);
  });
});

describe("grid editing", () => {
  const block = { blockId: "a", x: 10, y: 1, width: 4, height: 2, hidden: false };

  it("clamps blocks into the 12-column grid", () => {
    expect(clampLayoutItem(block)).toMatchObject({ x: 8, width: 4 });
    expect(moveLayoutItem(block, -20, -5)).toMatchObject({ x: 0, y: 0 });
    expect(resizeLayoutItem(block, 20, -5)).toMatchObject({ width: 12, x: 0, height: 1 });
  });

  it("converts pointer pixels into whole cells", () => {
    expect(pixelsToCells(130, 49, 60, 48)).toEqual({ dx: 2, dy: 1 });
    expect(pixelsToCells(10, 10, 0, 48)).toEqual({ dx: 0, dy: 0 });
  });
});
