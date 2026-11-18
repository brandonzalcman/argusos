import { blockTypeSchema } from "@argus/schema";
import { describe, expect, it } from "vitest";
import {
  compileComponent,
  disallowedImportMessage,
  findDisallowedImport,
} from "../src/sandbox/compile.js";
import { formatConsoleArg, formatConsoleArgs } from "../src/sandbox/console-format.js";
import { blankComponentTemplate, getBlockTemplate } from "../src/templates/index.js";

describe("compileComponent", () => {
  it("compiles TSX with types, JSX and allowed imports", () => {
    const result = compileComponent(
      `import { useProps } from "@argus/component-sdk";\nimport { useState } from "react";\n` +
        `export default function A() { const p: number = 1; return <div>{p}</div>; }`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.imports).toEqual(["@argus/component-sdk", "react"]);
      expect(result.code).toContain("React.createElement");
    }
  });

  it("reports syntax errors with 1-based line and column", () => {
    const result = compileComponent("export default function A() {\n  return <div>\n}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(3);
      expect(result.error.column).toBeGreaterThan(0);
      expect(result.error.message).not.toMatch(/^Error transforming/);
    }
  });

  it.each([
    ["fs", `import fs from "fs";`],
    ["relative path", `import x from "../x";`],
    ["url", `import x from "https://evil.example/x.js";`],
    ["node: scheme", `import x from "node:fs";`],
    ["react subpath", `import x from "react/jsx-runtime";`],
    ["side-effect import", `import "left-pad";`],
    ["require call", `const x = require("child_process");`],
    ["dynamic import", `import("https://evil.example/x.js");`],
  ])("rejects disallowed import: %s", (_name, line) => {
    const result = compileComponent(`${line}\nexport default function A() { return null; }`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/not allowed/);
  });

  it("rejects an unused disallowed import with its line", () => {
    const result = compileComponent(`import { x } from "lodash";\nexport default () => null;`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBe(1);
  });

  it("allowlist helpers", () => {
    expect(findDisallowedImport(["react", "@argus/component-sdk"])).toBeNull();
    expect(findDisallowedImport(["react", "fs"])).toBe("fs");
    expect(disallowedImportMessage("x".repeat(500)).length).toBeLessThan(300);
  });
});

describe("block templates", () => {
  const types = blockTypeSchema.options;

  it("covers every block type", () => {
    for (const type of types) expect(getBlockTemplate(type).source.length).toBeGreaterThan(20);
  });

  it.each(types)("template %s compiles with the sandbox compiler", (type) => {
    const { source } = getBlockTemplate(type);
    const result = compileComponent(source);
    if (!result.ok) {
      throw new Error(
        `${type}: ${result.error.message} at ${result.error.line}:${result.error.column}`,
      );
    }
    expect(result.imports.every((i) => i === "react" || i === "@argus/component-sdk")).toBe(true);
  });

  it("blank template compiles", () => {
    expect(compileComponent(blankComponentTemplate.source).ok).toBe(true);
  });

  it("declares well-formed props and never reaches for network or eval", () => {
    for (const type of types) {
      const { props, source } = getBlockTemplate(type);
      const keys = props.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const p of props) expect(p.type === "enum" ? true : p.options.length === 0).toBe(true);
      expect(source).not.toMatch(/eval\(|new Function|fetch\(|XMLHttpRequest/);
    }
  });

  it("returns independent copies", () => {
    const a = getBlockTemplate("stat");
    a.props.pop();
    expect(getBlockTemplate("stat").props.length).toBeGreaterThan(a.props.length);
  });
});

describe("console formatting", () => {
  it("handles circular, huge, and unserializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatConsoleArg(circular)).toContain("[circular]");
    expect(formatConsoleArg("x".repeat(10_000)).length).toBeLessThanOrEqual(2_000);
    expect(formatConsoleArg(10n)).toBe("10");
    expect(formatConsoleArgs(Array.from({ length: 50 }, () => 1))).toHaveLength(8);
  });
});

describe("sandbox runtime and frame (DOM)", () => {
  it.todo("renders the default export of compiled source inside #root with React 19");
  it.todo("posts render-error with phase and line/column for compile and execute failures");
  it.todo("mounts an error boundary and reports render errors without crashing the frame");
  it.todo("applies theme tokens as CSS variables and re-applies them on a props-only load");
  it.todo("reports resize through ResizeObserver and caps console output per second");
  it.todo("SandboxFrame uses sandbox=allow-scripts only and a required accessible title");
  it.todo("SandboxFrame drops messages from other windows and non-null origins");
  it.todo("SandboxFrame debounces load re-sends on source/props change and clamps height");
  it.todo("SandboxFrame tears down a frame whose heartbeat stops or that navigates away");
});
