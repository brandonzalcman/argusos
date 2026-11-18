import { describe, expect, it } from "vitest";
import {
  type CommandPaletteItem,
  type CommandPaletteSource,
  filterCommands,
  flattenResults,
  moveActiveIndex,
  scoreCommand,
} from "./command-model.js";
import { clampSplit, pointerToSplit, splitFromKey } from "./split-pane-math.js";

const item = (title: string, extra: Partial<CommandPaletteItem> = {}): CommandPaletteItem => ({
  id: title,
  title,
  kind: "navigation",
  targetId: `/${title}`,
  ...extra,
});

describe("command palette ranking", () => {
  const items = [
    item("Workflows"),
    item("Incidents", { keywords: ["events"] }),
    item("Tables"),
    item("Maps"),
  ];

  it("returns everything in original order for an empty query", () => {
    expect(filterCommands(items, "  ").map((i) => i.title)).toEqual([
      "Workflows",
      "Incidents",
      "Tables",
      "Maps",
    ]);
  });

  it("ranks prefix matches above substring and subsequence matches", () => {
    expect(scoreCommand(item("Maps"), "ma")).toBeGreaterThan(scoreCommand(item("Team maps"), "ma"));
    expect(scoreCommand(item("Team maps"), "ma")).toBeGreaterThan(
      scoreCommand(item("Tomato"), "ma"),
    );
    expect(scoreCommand(item("Tables"), "tbl")).toBeGreaterThan(0);
    expect(scoreCommand(item("Tables"), "zzz")).toBe(0);
  });

  it("matches keywords and ignores case and accents", () => {
    expect(filterCommands(items, "EVENTS").map((i) => i.title)).toEqual(["Incidents"]);
    expect(scoreCommand(item("Évacuation"), "evac")).toBeGreaterThan(0);
  });

  it("applies the result limit", () => {
    expect(filterCommands(items, "", 2)).toHaveLength(2);
  });

  it("flattens only ready sources, in source order", () => {
    const source = (id: string): CommandPaletteSource => ({
      id,
      label: id,
      search: async () => [],
    });
    const flat = flattenResults([source("a"), source("b"), source("c")], {
      a: { status: "ready", items: [item("One")] },
      b: { status: "error", message: "down" },
      c: { status: "ready", items: [item("Two"), item("Three")] },
    });
    expect(flat.map((i) => i.title)).toEqual(["One", "Two", "Three"]);
  });

  it("wraps keyboard movement and handles empty lists", () => {
    expect(moveActiveIndex(0, -1, 3)).toBe(2);
    expect(moveActiveIndex(2, 1, 3)).toBe(0);
    expect(moveActiveIndex(-1, 1, 3)).toBe(0);
    expect(moveActiveIndex(-1, -1, 3)).toBe(2);
    expect(moveActiveIndex(1, 1, 0)).toBe(-1);
  });
});

describe("split pane sizing", () => {
  const bounds = { min: 20, max: 80 };

  it("clamps to bounds and recovers from non-finite input", () => {
    expect(clampSplit(5, bounds)).toBe(20);
    expect(clampSplit(95, bounds)).toBe(80);
    expect(clampSplit(Number.NaN, bounds)).toBe(50);
    expect(clampSplit(33.333, bounds)).toBe(33.3);
  });

  it("converts pointer positions to percentages", () => {
    expect(pointerToSplit(300, 100, 400)).toBe(50);
    expect(pointerToSplit(10, 0, 0)).toBe(50);
  });

  it("follows the window-splitter keyboard model", () => {
    const horizontal = { orientation: "horizontal" as const };
    expect(splitFromKey("ArrowRight", 50, bounds, horizontal)).toBe(52);
    expect(splitFromKey("ArrowLeft", 50, bounds, { ...horizontal, shift: true })).toBe(40);
    expect(splitFromKey("Home", 50, bounds, horizontal)).toBe(20);
    expect(splitFromKey("End", 50, bounds, horizontal)).toBe(80);
    expect(splitFromKey("ArrowDown", 50, bounds, horizontal)).toBeNull();
    expect(splitFromKey("ArrowDown", 50, bounds, { orientation: "vertical" })).toBe(52);
  });

  it("mirrors horizontal arrows in right-to-left layouts", () => {
    expect(
      splitFromKey("ArrowRight", 50, bounds, { orientation: "horizontal", reverse: true }),
    ).toBe(48);
  });
});
