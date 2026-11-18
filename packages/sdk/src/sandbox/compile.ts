import { transform } from "sucrase";

/** Modules a custom component may import. Everything else is rejected before execution. */
export const ALLOWED_IMPORTS: readonly string[] = ["react", "@argus/component-sdk"];

export interface CompileError {
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}

export type CompileResult =
  | { readonly ok: true; readonly code: string; readonly imports: readonly string[] }
  | { readonly ok: false; readonly error: CompileError };

export function isAllowedImport(specifier: string): boolean {
  return ALLOWED_IMPORTS.includes(specifier);
}

/** Message for a rejected module specifier; shared by the static check and the runtime `require`. */
export function disallowedImportMessage(specifier: string): string {
  const shown = specifier.length > 80 ? `${specifier.slice(0, 80)}...` : specifier;
  return `Import "${shown}" is not allowed. Components can only import ${ALLOWED_IMPORTS.map((m) => `"${m}"`).join(" and ")}.`;
}

const REQUIRE_RE = /\brequire\(\s*(["'])((?:(?!\1).)*)\1\s*\)/g;

/** Extract literal module specifiers from compiled (CommonJS) output. */
export function collectImports(compiledCode: string): string[] {
  const found = new Set<string>();
  for (const match of compiledCode.matchAll(REQUIRE_RE)) {
    found.add(match[2] ?? "");
  }
  return [...found];
}

/** First disallowed specifier in the list, or null. */
export function findDisallowedImport(specifiers: readonly string[]): string | null {
  return specifiers.find((s) => !isAllowedImport(s)) ?? null;
}

/**
 * Compile TSX to a CommonJS function body.
 * - transforms: typescript, jsx (classic; `React` is supplied by the runtime), imports.
 * - unused imports are kept so the allowlist applies to every import the author wrote.
 * Pure: no execution, no I/O. Errors carry 1-based line/column when the parser reports them.
 */
export function compileComponent(source: string): CompileResult {
  let code: string;
  try {
    code = transform(source, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      production: true,
      filePath: "component.tsx",
      keepUnusedImports: true,
      disableESTransforms: true,
    }).code;
  } catch (error: unknown) {
    return { ok: false, error: toCompileError(error) };
  }
  const imports = collectImports(code);
  const bad = findDisallowedImport(imports);
  if (bad !== null) {
    return { ok: false, error: { message: disallowedImportMessage(bad), ...locateImport(source, bad) } };
  }
  return { ok: true, code, imports };
}

function locateImport(source: string, specifier: string): { line: number | null; column: number | null } {
  for (const quote of ['"', "'"]) {
    const index = source.indexOf(`${quote}${specifier}${quote}`);
    if (index >= 0) {
      const before = source.slice(0, index);
      const line = before.split("\n").length;
      return { line, column: index - before.lastIndexOf("\n") };
    }
  }
  return { line: null, column: null };
}

function toCompileError(error: unknown): CompileError {
  const e = error as { message?: unknown; loc?: { line?: unknown; column?: unknown } };
  const raw = typeof e.message === "string" ? e.message : "Unknown compile error";
  const message = raw
    .replace(/^Error transforming [^:]*:\s*/, "")
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .slice(0, 500);
  const line = typeof e.loc?.line === "number" ? e.loc.line : null;
  const column = typeof e.loc?.column === "number" ? e.loc.column : null;
  return { message, line, column };
}
