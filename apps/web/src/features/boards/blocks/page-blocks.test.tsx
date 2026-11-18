import type { ComponentProp } from "@argus/schema";
import { describe, expect, it } from "vitest";
import {
  componentAvailability,
  mergeComponentProps,
  readComponentConfig,
} from "./component-model.js";
import { checkEmbed, MAX_EMBED_DEPTH } from "./embed-model.js";
import { readLinkList, resolveLinkTarget, safeExternalUrl } from "./link-model.js";
import { BLOCK_DATA_TIMEOUT_MS, withTimeout } from "./use-block-rows.js";

const prop = (key: string, defaultValue: ComponentProp["defaultValue"]): ComponentProp => ({
  key,
  label: key,
  description: null,
  type: "string",
  required: false,
  defaultValue,
  options: [],
});

describe("safeExternalUrl", () => {
  it("accepts http(s) only", () => {
    expect(safeExternalUrl("https://example.org/a")).toBe("https://example.org/a");
    expect(safeExternalUrl("http://example.org")).toBe("http://example.org/");
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://example.org",
      "/relative",
      "//example.org",
      "https://user:pw@example.org",
      "not a url",
      "",
    ]) {
      expect(safeExternalUrl(bad)).toBeNull();
    }
  });
});

describe("link list model", () => {
  it("drops malformed items and defaults layout to list", () => {
    const model = readLinkList({
      links: [
        { label: "Ok", target: { type: "board", boardId: "b1" } },
        { label: "", target: { type: "board", boardId: "b1" } },
        { label: "Bad", target: { type: "nope" } },
        "junk",
      ],
    });
    expect(model.layout).toBe("list");
    expect(model.links).toHaveLength(1);
  });
  it("resolves targets and marks unsafe urls unavailable", () => {
    expect(resolveLinkTarget({ type: "page", pageId: "p" })).toEqual({ kind: "page", pageId: "p" });
    expect(resolveLinkTarget({ type: "url", url: "javascript:1" }).kind).toBe("unavailable");
    expect(resolveLinkTarget({ type: "url", url: "https://example.org" }).kind).toBe("external");
  });
});

describe("embed recursion guard", () => {
  it("allows nested embeds up to the limit", () => {
    expect(checkEmbed(["root"], "a")).toBe("ok");
    expect(checkEmbed(["root", "a"], "b")).toBe("ok");
  });
  it("rejects cycles and over-deep nesting", () => {
    expect(checkEmbed(["root"], "root")).toBe("cycle");
    expect(checkEmbed(["root", "a"], "root")).toBe("cycle");
    expect(checkEmbed(["root", "a", "b"], "c")).toBe("too-deep");
    expect(MAX_EMBED_DEPTH).toBe(2);
  });
});

describe("custom component props", () => {
  it("merges authored values over declared defaults", () => {
    const merged = mergeComponentProps([prop("a", "x"), prop("b", 2), prop("c", null)], {
      a: "override",
      extra: true,
      b: undefined,
    });
    expect(merged).toEqual({ a: "override", b: 2, extra: true });
  });
  it("only runs unpublished versions in the builder", () => {
    expect(componentAvailability({ publishedAt: null }, "runtime")).toBe("unpublished");
    expect(componentAvailability({ publishedAt: null }, "builder")).toBe("ok");
    expect(componentAvailability({ publishedAt: "2026-01-01T00:00:00Z" }, "runtime")).toBe("ok");
  });
  it("reads config defensively", () => {
    expect(readComponentConfig({ componentId: "", componentVersion: 1, props: {} })).toBeNull();
    expect(readComponentConfig({ componentId: "c", componentVersion: 0, props: {} })).toBeNull();
    expect(
      readComponentConfig({ componentId: "c", componentVersion: 2, props: null })?.props,
    ).toEqual({});
  });
});

describe("withTimeout", () => {
  it("rejects when the port never settles", async () => {
    expect(BLOCK_DATA_TIMEOUT_MS).toBeGreaterThan(0);
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(/timed out/);
    await expect(withTimeout(Promise.resolve(1), 10)).resolves.toBe(1);
  });
});
