import type { DefinitionIssue } from "@argus/schema";
import { type JsonNode, scanJson } from "./json-scanner.js";

export type EditorDiagnosticSeverity = "error" | "warning" | "info";

/** A problem to underline in the editor. Offsets are UTF-16 code units into the document. */
export interface EditorDiagnostic {
  readonly from: number;
  readonly to: number;
  readonly severity: EditorDiagnosticSeverity;
  readonly message: string;
}

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

export type JsonPath = readonly (string | number)[];

function childAt(node: JsonNode, segment: string | number): JsonNode | null {
  if (node.kind === "array") {
    const index =
      typeof segment === "number" ? segment : /^\d+$/.test(segment) ? Number(segment) : -1;
    return node.items[index] ?? null;
  }
  if (node.kind === "object") {
    const key = String(segment);
    // Duplicate keys: the last one wins, as in JSON.parse.
    for (let i = node.entries.length - 1; i >= 0; i--) {
      const entry = node.entries[i];
      if (entry && entry.key === key) return entry.value;
    }
  }
  return null;
}

function locate(root: JsonNode | null, path: JsonPath): JsonNode | null {
  let current = root;
  for (const segment of path) {
    if (!current) return null;
    current = childAt(current, segment);
  }
  return current;
}

/**
 * Finds the character range of the JSON value at a Zod-style path (`["blocks", 2, "title"]`).
 * Uses a tolerant scanner rather than JSON.parse so it works on half-edited documents.
 * Returns null when the path does not exist (e.g. a missing required key).
 */
export function jsonPathToRange(text: string, path: JsonPath): TextRange | null {
  const node = locate(scanJson(text).root, path);
  return node ? { from: node.from, to: node.to } : null;
}

/**
 * Maps validation issues onto editor diagnostics. When the exact path is absent (typically a
 * missing required key) the nearest existing ancestor is highlighted; if nothing resolves the
 * diagnostic sits at 0..0 so it is still listed rather than silently dropped.
 */
export function issuesToDiagnostics(
  text: string,
  issues: readonly DefinitionIssue[],
): EditorDiagnostic[] {
  const root = scanJson(text).root;
  return issues.map((issue) => {
    let node: JsonNode | null = null;
    for (let length = issue.path.length; length >= 0 && !node; length--) {
      node = locate(root, issue.path.slice(0, length));
    }
    return {
      from: node?.from ?? 0,
      to: node?.to ?? 0,
      severity: issue.severity,
      message: issue.message,
    };
  });
}

const MAX_MESSAGE_LENGTH = 2_000;

/** Converts a ZodError-shaped value (structural, so any Zod version works) to DefinitionIssues. */
export function zodIssuesToDefinitionIssues(error: {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
}): DefinitionIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === "number" && Number.isInteger(segment)
        ? segment
        : typeof segment === "symbol"
          ? (segment.description ?? "symbol")
          : String(segment),
    ),
    message: (issue.message || "Invalid value").slice(0, MAX_MESSAGE_LENGTH),
    severity: "error" as const,
  }));
}
