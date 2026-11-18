import type { MenuItem } from "@argus/schema";
import { describe, expect, it } from "vitest";
import {
  checkThemeContrast,
  contrastRatio,
  findLayoutOverlaps,
  flattenMenu,
  isSafeMenuUrl,
  moveMenuItem,
  previewMenuForPosition,
  removeMenuItem,
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
