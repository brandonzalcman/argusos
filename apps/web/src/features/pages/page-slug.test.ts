import { describe, expect, it } from "vitest";
import { pageUrlPath, validatePageSlug } from "./page-slug.js";

describe("validatePageSlug", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(validatePageSlug("duty-officer")).toBeNull();
    expect(validatePageSlug("op4")).toBeNull();
  });

  it.each([
    ["", /Enter a URL slug/],
    ["Duty-Officer", /lowercase/],
    ["duty officer", /spaces/],
    ["duty_officer", /underscores/],
    ["-duty", /hyphen/],
    ["duty-", /hyphen/],
    ["duty--officer", /single hyphen/],
    ["duty/officer", /lowercase letters, digits/],
    ["a".repeat(81), /80 characters/],
  ])("rejects %j with an actionable message", (slug, message) => {
    expect(validatePageSlug(slug)).toMatch(message);
  });

  it("previews the URL and hides invalid slugs", () => {
    expect(pageUrlPath("duty-officer")).toBe("/p/duty-officer");
    expect(pageUrlPath("Bad Slug")).toBe("/p/…");
  });
});
