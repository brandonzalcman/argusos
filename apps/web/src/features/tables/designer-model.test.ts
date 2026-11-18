import { describe, expect, it } from "vitest";
import {
  createDraftField,
  defaultConfigFor,
  describeDraftChanges,
  slugifyKey,
  uniqueKey,
  validateDraft,
} from "./designer-model.js";
import { fixtureFields, fixtureTitle } from "./test-fixtures.js";

describe("designer-model (test fixtures)", () => {
  it("slugifies keys to the definition-key pattern", () => {
    expect(slugifyKey("Priority Level!")).toBe("priority_level");
    expect(slugifyKey("9 lives")).toBe("f_9_lives");
    expect(slugifyKey("")).toBe("field");
    expect(uniqueKey("title", new Set(["title"]))).toBe("title_2");
  });

  it("creates drafts with type defaults", () => {
    const f = createDraftField("status", "Status", new Set());
    expect(f.config).toEqual(defaultConfigFor("status"));
  });

  it("validates options, relations and duplicate names", () => {
    const select = createDraftField("single-select", "Kind", new Set());
    const dupe = { ...createDraftField("text", "kind", new Set(["x"])), key: "kind_2" };
    const rollup = createDraftField("rollup", "Total", new Set());
    const messages = validateDraft([select, dupe, rollup], new Map()).map((i) => i.message);
    expect(messages).toContain("Add at least one option.");
    expect(messages.some((m) => m.includes("already named"))).toBe(true);
    expect(messages).toContain("Choose a link field to read through.");
  });

  it("describes added, modified and removed fields in plain words", () => {
    const added = createDraftField("number", "Priority", new Set());
    const renamed = { ...fixtureTitle, name: "Headline" };
    const text = describeDraftChanges(fixtureFields, [renamed, added]).map(
      (c) => `${c.kind}:${c.description}`,
    );
    expect(text.some((t) => t.startsWith("added:Add field “Priority”"))).toBe(true);
    expect(text.some((t) => t.startsWith("modified:“Title”: rename to “Headline”"))).toBe(true);
    expect(text.filter((t) => t.startsWith("removed:"))).toHaveLength(2);
  });
});
