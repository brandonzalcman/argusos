import type { DefinitionIssue } from "@argus/schema";
import { describe, expect, it } from "vitest";
import {
  issuesToDiagnostics,
  jsonPathToRange,
  zodIssuesToDefinitionIssues,
} from "./diagnostics.js";
import { formatJson, parseJsonSafe } from "./json.js";

const doc = formatJson({
  title: 'Ops "main" board',
  blocks: [
    { id: "a", props: { label: "one" } },
    { id: "b", props: { label: "two", tags: ["x", "y"] } },
  ],
  'we"ird': 7,
});

function slice(text: string, path: (string | number)[]): string | null {
  const range = jsonPathToRange(text, path);
  return range ? text.slice(range.from, range.to) : null;
}

describe("jsonPathToRange", () => {
  it("returns the whole document for an empty path", () => {
    expect(slice(doc, [])).toBe(doc);
  });

  it("locates nested object and array values", () => {
    expect(slice(doc, ["blocks", 1, "props", "label"])).toBe('"two"');
    expect(slice(doc, ["blocks", 1, "props", "tags", 1])).toBe('"y"');
    expect(slice(doc, ["blocks", 0])).toContain('"id": "a"');
    expect(slice(doc, ["blocks"])?.startsWith("[")).toBe(true);
  });

  it("is not confused by escaped quotes in strings and keys", () => {
    expect(slice(doc, ["title"])).toBe('"Ops \\"main\\" board"');
    expect(slice(doc, ['we"ird'])).toBe("7");
  });

  it("handles brackets inside strings", () => {
    const text = '{"a": "}],{", "b": 1}';
    expect(slice(text, ["b"])).toBe("1");
  });

  it("returns null for missing keys, indexes and wrong shapes", () => {
    expect(jsonPathToRange(doc, ["nope"])).toBeNull();
    expect(jsonPathToRange(doc, ["blocks", 5])).toBeNull();
    expect(jsonPathToRange(doc, ["title", "x"])).toBeNull();
  });

  it("still resolves earlier values in a truncated document", () => {
    const text = '{"a": 1, "b": {"c": tru';
    expect(slice(text, ["a"])).toBe("1");
    expect(slice(text, ["b", "c"])).toBe("tru");
  });

  it("uses the last of duplicate keys", () => {
    expect(slice('{"a": 1, "a": 2}', ["a"])).toBe("2");
  });
});

describe("issuesToDiagnostics", () => {
  const issues: DefinitionIssue[] = [
    { path: ["blocks", 0, "id"], message: "bad id", severity: "error" },
    { path: ["blocks", 1, "props", "missing"], message: "required", severity: "warning" },
    { path: ["nowhere", "deep"], message: "lost", severity: "error" },
  ];

  it("maps severity, message and range", () => {
    const [first] = issuesToDiagnostics(doc, issues);
    expect(first?.severity).toBe("error");
    expect(first?.message).toBe("bad id");
    expect(doc.slice(first?.from, first?.to)).toBe('"a"');
  });

  it("falls back to the nearest existing ancestor for missing keys", () => {
    const second = issuesToDiagnostics(doc, issues)[1];
    expect(second?.severity).toBe("warning");
    expect(doc.slice(second?.from, second?.to)).toContain('"label": "two"');
  });

  it("falls back to the root, and to 0..0 when nothing parses", () => {
    const third = issuesToDiagnostics(doc, issues)[2];
    expect(third?.from).toBe(0);
    expect(third?.to).toBe(doc.length);
    expect(issuesToDiagnostics("", issues)[2]).toMatchObject({ from: 0, to: 0 });
  });
});

describe("zodIssuesToDefinitionIssues", () => {
  it("normalises paths and defaults to error severity", () => {
    const sym = Symbol("s");
    const result = zodIssuesToDefinitionIssues({
      issues: [{ path: ["a", 2, sym, 1.5], message: "" }],
    });
    expect(result).toEqual([
      { path: ["a", 2, "s", "1.5"], message: "Invalid value", severity: "error" },
    ]);
  });
});

describe("parseJsonSafe", () => {
  it("parses valid JSON", () => {
    expect(parseJsonSafe('{"a":[1]}')).toEqual({ ok: true, value: { a: [1] } });
  });

  it("reports the offset of an unexpected token", () => {
    const text = '{"a": }';
    const result = parseJsonSafe(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.offset).toBe(text.indexOf("}"));
  });

  it("reports an offset inside the text for multi-line input", () => {
    const text = '{\n  "a": 1,\n  "b": oops\n}';
    const result = parseJsonSafe(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offset).toBeGreaterThanOrEqual(text.indexOf("oops"));
      expect(result.offset).toBeLessThan(text.length);
    }
  });

  it("clamps truncated input to the end of the text", () => {
    const text = '{"a": [1, 2';
    const result = parseJsonSafe(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.offset).toBe(text.length);
  });
});

describe("formatJson", () => {
  it("uses two-space indentation and never returns undefined", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatJson(undefined)).toBe("null");
  });
});

describe("CodeEditor (needs a DOM)", () => {
  it.todo("does not move the cursor when the controlled value equals the document");
  it.todo("replaces the document when the external value differs");
  it.todo("applies diagnostics and clamps offsets beyond the document length");
  it.todo("calls onSave on Ctrl/Cmd+S and not onChange");
  it.todo("lets focus leave with Escape then Tab");
  it.todo("exposes aria-label and aria-readonly on the content element");
});
