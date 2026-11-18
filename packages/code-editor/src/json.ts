import { scanJson } from "./json-scanner.js";

/** Pretty-prints a value with 2-space indentation. Key order is whatever the value has. */
export function formatJson(value: unknown): string {
  // JSON.stringify returns undefined for undefined/functions/symbols; the editor needs text.
  return JSON.stringify(value, null, 2) ?? "null";
}

export type ParseJsonResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string; readonly offset: number };

const POSITION_PATTERN = /position (\d+)/;
const LINE_COLUMN_PATTERN = /line (\d+) column (\d+)/;

function offsetFromLineColumn(text: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const next = text.indexOf("\n", offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return Math.min(offset + column - 1, text.length);
}

/**
 * Parses JSON without throwing. On failure returns the engine message and a best-effort
 * character offset (clamped to the text) suitable for placing an editor diagnostic.
 */
export function parseJsonSafe(text: string): ParseJsonResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = POSITION_PATTERN.exec(message);
    const lineColumn = LINE_COLUMN_PATTERN.exec(message);
    let offset: number | null;
    if (position?.[1] !== undefined) {
      offset = Number(position[1]);
    } else if (lineColumn?.[1] !== undefined && lineColumn[2] !== undefined) {
      offset = offsetFromLineColumn(text, Number(lineColumn[1]), Number(lineColumn[2]));
    } else {
      // Engines differ in whether they report a position; fall back to our own scanner.
      offset = scanJson(text).errorOffset;
    }
    return {
      ok: false,
      message,
      offset: Math.max(0, Math.min(offset ?? text.length, text.length)),
    };
  }
}
