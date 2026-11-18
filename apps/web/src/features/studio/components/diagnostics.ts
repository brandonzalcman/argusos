import type { EditorDiagnostic } from "@argus/code-editor";
import { compileComponent } from "@argus/sdk/compiler";

/** Converts a 1-based line and column to a UTF-16 offset, clamped to the line. */
export function lineColumnToOffset(
  text: string,
  line: number | null,
  column: number | null,
): number {
  if (line === null || line < 1) return 0;
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf("\n", offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  const lineEnd = text.indexOf("\n", offset);
  const end = lineEnd === -1 ? text.length : lineEnd;
  const col = column !== null && column >= 1 ? column - 1 : 0;
  return Math.min(offset + col, end);
}

/** Range to underline for a located error: the word at the position, else one character. */
export function errorRange(
  text: string,
  line: number | null,
  column: number | null,
): { readonly from: number; readonly to: number } {
  const from = lineColumnToOffset(text, line, column);
  const word = /^[\p{L}\p{N}_$]+/u.exec(text.slice(from));
  const lineEnd = text.indexOf("\n", from);
  const limit = lineEnd === -1 ? text.length : lineEnd;
  const to = Math.min(limit, from + (word ? word[0].length : 1));
  return { from, to: Math.max(from, to) };
}

export interface CompileProblem {
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
  readonly from: number;
  readonly to: number;
}

/** Compiles the source (never executing it) and reports a located problem, if any. */
export function compileProblems(source: string): CompileProblem[] {
  const result = compileComponent(source);
  if (result.ok) return [];
  const { message, line, column } = result.error;
  return [{ message, line, column, ...errorRange(source, line, column) }];
}

export function problemsToDiagnostics(problems: readonly CompileProblem[]): EditorDiagnostic[] {
  return problems.map((p) => ({
    from: p.from,
    to: p.to,
    severity: "error" as const,
    message: p.message,
  }));
}
