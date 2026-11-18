import { pageDefinitionSchema } from "@argus/schema";
import { describe, expect, it } from "vitest";
import { addBlock, moveBlockTo } from "../boards/index.js";
import { bundleToPage, pageToBundle } from "./page-bundle.js";
import { summarizePageChanges } from "./page-summary.js";
import { makePageFixture } from "./test-fixtures.js";

const SECOND = "a1000000-0000-4000-8000-0000000000b2";

describe("page bundle adapter", () => {
  it("round-trips an unchanged page exactly", () => {
    const page = makePageFixture();
    expect(bundleToPage(page, pageToBundle(page))).toEqual(page);
  });

  it("exposes blocks and layouts to the board machinery", () => {
    const page = makePageFixture();
    const bundle = pageToBundle(page);
    expect(bundle.definition.blocks).toBe(page.blocks);
    expect(bundle.layout.layouts).toBe(page.layouts);
    expect(bundle.definition.name).toBe(page.title);
    expect(bundle.layout.columns).toBe(12);
  });

  it("applies builder edits to blocks and layouts and keeps page-only fields", () => {
    const page = makePageFixture({
      homepageForPositionIds: ["a1000000-0000-4000-8000-0000000000f1"],
      access: { positionIds: ["a1000000-0000-4000-8000-0000000000f2"], visibilityRule: null },
    });
    let bundle = pageToBundle(page);
    bundle = addBlock(bundle, "rich-text", "Second note", SECOND);
    bundle = moveBlockTo(bundle, "desktop", SECOND, { x: 0, y: 5, width: 6, height: 2 });
    const next = bundleToPage(page, bundle);
    expect(next.blocks.map((b) => b.name)).toEqual(["Fixture note", "Second note"]);
    expect(next.slug).toBe(page.slug);
    expect(next.title).toBe(page.title);
    expect(next.icon).toBe(page.icon);
    expect(next.homepageForPositionIds).toEqual(page.homepageForPositionIds);
    expect(next.access).toEqual(page.access);
    expect(next.id).toBe(page.id);
    expect(pageDefinitionSchema.safeParse(next).success).toBe(true);
  });

  it("does not let a bundle rename change the page title", () => {
    const page = makePageFixture();
    const bundle = pageToBundle(page);
    const renamed = { ...bundle, definition: { ...bundle.definition, name: "Other" } };
    expect(bundleToPage(page, renamed).title).toBe(page.title);
  });

  it("keeps the page layouts when the bundle has none (a page needs at least one)", () => {
    const page = makePageFixture();
    const bundle = pageToBundle(page);
    const empty = { ...bundle, layout: { ...bundle.layout, layouts: [] } };
    expect(bundleToPage(page, empty).layouts).toEqual(page.layouts);
  });

  it("does not mutate its inputs", () => {
    const page = makePageFixture();
    const snapshot = structuredClone(page);
    bundleToPage(page, addBlock(pageToBundle(page), "rich-text", "X", SECOND));
    expect(page).toEqual(snapshot);
  });
});

describe("summarizePageChanges", () => {
  it("describes a first publication", () => {
    expect(summarizePageChanges(null, makePageFixture())[0]).toMatch(/First publication/);
  });

  it("reports nothing when identical", () => {
    const page = makePageFixture();
    expect(summarizePageChanges(page, structuredClone(page))).toEqual([]);
  });

  it("calls out slug changes because old links break", () => {
    const page = makePageFixture();
    const changes = summarizePageChanges(page, { ...page, slug: "renamed" });
    expect(changes.join(" ")).toMatch(/old links stop working/);
  });

  it("lists added, removed and edited blocks", () => {
    const page = makePageFixture();
    const added = bundleToPage(
      page,
      addBlock(pageToBundle(page), "rich-text", "Added note", SECOND),
    );
    expect(summarizePageChanges(page, added).join(" ")).toMatch(/Added: Added note/);
    expect(summarizePageChanges(added, page).join(" ")).toMatch(/Removed: Added note/);
    const first = page.blocks[0];
    if (!first) throw new Error("fixture has a block");
    const edited = { ...page, blocks: [{ ...first, name: "Renamed note" }] };
    expect(summarizePageChanges(page, edited).join(" ")).toMatch(/Edited: Renamed note/);
  });
});
