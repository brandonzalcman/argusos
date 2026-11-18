import { describe, expect, it } from "vitest";
import { tokenizeCel } from "./cel.js";

const classes = (source: string) => tokenizeCel(source).map((token) => [token.text, token.class]);

describe("tokenizeCel", () => {
  it("classifies a boolean comparison", () => {
    expect(classes('record.status == "open" && !record.closed')).toEqual([
      ["record", "identifier"],
      [".", "punctuation"],
      ["status", "property"],
      ["==", "operator"],
      ['"open"', "string"],
      ["&&", "operator"],
      ["!", "operator"],
      ["record", "identifier"],
      [".", "punctuation"],
      ["closed", "property"],
    ]);
  });

  it("treats true/false/null/in as keywords", () => {
    expect(classes("x in [true, false, null]").map(([, c]) => c)).toEqual([
      "identifier",
      "keyword",
      "punctuation",
      "keyword",
      "punctuation",
      "keyword",
      "punctuation",
      "keyword",
      "punctuation",
    ]);
  });

  it("prefers two-character operators and recognises the ternary", () => {
    expect(
      classes("a <= b || c != d ? 1 : 2")
        .filter(([, c]) => c === "operator")
        .map(([t]) => t),
    ).toEqual(["<=", "||", "!=", "?", ":"]);
  });

  it("recognises numbers, including decimals and exponents", () => {
    expect(classes("1 2.5 1e3 0x1F 7u").every(([, c]) => c === "number")).toBe(true);
  });

  it("handles escapes, single quotes and unterminated strings", () => {
    expect(classes(String.raw`'it\'s' "a\"b"`)).toEqual([
      [String.raw`'it\'s'`, "string"],
      [String.raw`"a\"b"`, "string"],
    ]);
    expect(classes('"open')).toEqual([['"open', "string"]]);
  });

  it("marks calls as functions and method names after a dot as functions too", () => {
    expect(
      classes("now() > size(x)")
        .filter(([, c]) => c === "function")
        .map(([t]) => t),
    ).toEqual(["now", "size"]);
    expect(classes("user.position.name")[4]).toEqual(["name", "property"]);
  });

  it("flags unknown characters", () => {
    expect(classes("a @ b")[1]).toEqual(["@", "invalid"]);
  });

  it("reports contiguous offsets", () => {
    const [first, second] = tokenizeCel("ab  cd");
    expect([first?.from, first?.to, second?.from, second?.to]).toEqual([0, 2, 4, 6]);
  });
});
