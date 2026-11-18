import {
  type CustomComponentDefinition,
  customComponentDefinitionSchema,
  type SessionSnapshot,
  type StudioItemPermissions,
} from "@argus/schema";
import { validateCapabilities } from "./capabilities-model.js";
import type { CompileProblem } from "./diagnostics.js";
import { validateProps } from "./props-model.js";

export type EditorAccess =
  | { readonly state: "signed-out" }
  | { readonly state: "no-access" }
  | {
      readonly state: "ready";
      readonly canEdit: boolean;
      readonly canPublish: boolean;
      readonly canEditCode: boolean;
      /** Why everything is read-only, or null when editable. */
      readonly readOnlyReason: string | null;
    };

/**
 * Combines the session's StudioPermissions with the definition's own permissions. The server
 * re-checks every call; this only decides what the UI offers.
 */
export function resolveEditorAccess(
  snapshot: SessionSnapshot | null,
  item: StudioItemPermissions | null,
): EditorAccess {
  if (snapshot === null) return { state: "signed-out" };
  const studio = snapshot.studio;
  if (!studio.viewStudio) return { state: "no-access" };
  const canEditCode = studio.editCode && (item?.editCode ?? true);
  const canEdit = canEditCode && studio.editDefinitions && (item?.edit ?? true);
  const canPublish = canEdit && studio.publishDefinitions && (item?.publish ?? true);
  let readOnlyReason: string | null = null;
  if (!studio.editCode || !(item?.editCode ?? true)) {
    readOnlyReason =
      "Your position can't edit code, so this component is read-only. Ask an administrator for the “edit code” permission.";
  } else if (!canEdit) {
    readOnlyReason = "Your position can't edit definitions, so this component is read-only.";
  }
  return { state: "ready", canEdit, canPublish, canEditCode, readOnlyReason };
}

export type LoadFailure = "not-connected" | "not-found" | "forbidden" | "signed-out" | "error";

/** Classifies a studio error by the message prefix the API (and demo port) use. */
export function classifyStudioError(error: unknown): LoadFailure {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("TODO(implementation)")) return "not-connected";
  if (message.startsWith("not-found")) return "not-found";
  if (message.startsWith("forbidden")) return "forbidden";
  if (message.startsWith("unauthenticated")) return "signed-out";
  return "error";
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("definition-version-conflict");
}

export type ProblemArea = "source" | "props" | "capabilities" | "definition";

export interface EditorProblem {
  readonly id: string;
  readonly area: ProblemArea;
  readonly severity: "error" | "warning";
  readonly message: string;
  /** Source problems carry a location; others do not. */
  readonly line: number | null;
  readonly column: number | null;
  readonly from: number | null;
  readonly to: number | null;
}

/** All problems of a draft in one list: compile, props, capabilities and remaining schema issues. */
export function collectProblems(
  draft: CustomComponentDefinition,
  compile: readonly CompileProblem[],
): EditorProblem[] {
  const problems: EditorProblem[] = compile.map((p, i) => ({
    id: `source-${i}`,
    area: "source",
    severity: "error",
    message: p.message,
    line: p.line,
    column: p.column,
    from: p.from,
    to: p.to,
  }));
  const propIssues = validateProps(draft.props);
  propIssues.forEach((issue, i) => {
    const where =
      issue.index === null
        ? "Props"
        : `Prop ${issue.index + 1} (${draft.props[issue.index]?.key ?? ""})`;
    problems.push({
      id: `props-${i}`,
      area: "props",
      severity: "error",
      message: `${where}: ${issue.message}`,
      line: null,
      column: null,
      from: null,
      to: null,
    });
  });
  const capabilityIssues = validateCapabilities(draft.capabilities);
  capabilityIssues.forEach((issue, i) => {
    problems.push({
      id: `capabilities-${i}`,
      area: "capabilities",
      severity: issue.severity,
      message: issue.message,
      line: null,
      column: null,
      from: null,
      to: null,
    });
  });
  const parsed = customComponentDefinitionSchema.safeParse(draft);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue, i) => {
      const head = issue.path[0];
      if (head === "props" && propIssues.length > 0) return;
      if (head === "capabilities" && capabilityIssues.some((c) => c.severity === "error")) return;
      problems.push({
        id: `definition-${i}`,
        area: head === "props" ? "props" : head === "capabilities" ? "capabilities" : "definition",
        severity: "error",
        message: `${issue.path.join(".") || "definition"}: ${issue.message}`,
        line: null,
        column: null,
        from: null,
        to: null,
      });
    });
  }
  return problems;
}

export function hasBlockingProblems(problems: readonly EditorProblem[]): boolean {
  return problems.some((p) => p.severity === "error");
}

/** Schema-level validity: when false the server would reject a save. Compile errors don't count. */
export function isDraftSaveable(draft: CustomComponentDefinition): boolean {
  return customComponentDefinitionSchema.safeParse(draft).success;
}

export function newIdempotencyKey(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${id}`.slice(0, 200);
}
