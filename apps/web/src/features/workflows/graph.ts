import type { WorkflowEdge, WorkflowStep, WorkflowTrigger } from "@argus/schema";

export type StepType = WorkflowStep["type"];
export type TriggerType = WorkflowTrigger["type"];
export type EdgeBranch = WorkflowEdge["branch"];

export const STEP_TYPE_LABELS: Readonly<Record<StepType, string>> = {
  condition: "Condition",
  "create-record": "Create record",
  "update-record": "Update record",
  "assign-to-position": "Assign to position",
  "send-alert": "Send alert",
  "call-webhook": "Call webhook",
  wait: "Wait / delay",
  approval: "Approval",
  escalate: "Escalate",
  "plugin-action": "Run plugin action",
};

export const TRIGGER_TYPE_LABELS: Readonly<Record<TriggerType, string>> = {
  "record-created": "Record created",
  "record-updated": "Record updated",
  schedule: "Schedule (cron)",
  "incident-activated": "Incident activated",
  "incident-escalated": "Incident escalated",
  "inbound-webhook": "Inbound webhook",
  "form-submitted": "Form submitted",
  "button-clicked": "Button clicked",
};

/** Branches a step type may emit. "failed" is allowed on every step as an error path. */
export function branchesFor(type: StepType): readonly EdgeBranch[] {
  if (type === "condition") return ["true", "false", "failed"];
  if (type === "approval") return ["approved", "rejected", "failed"];
  return ["next", "failed"];
}

const baseRetry = { maximumAttempts: 3, backoffSeconds: 30 } as const;

/**
 * Creates a new step with empty (schema-invalid) config the author must complete.
 * Input: type and a caller-supplied id (crypto.randomUUID in the UI). Output: a draft step.
 * Errors: none; invalid drafts are reported by the form through workflowStepSchema.
 */
export function createStep(type: StepType, id: string): WorkflowStep {
  const base = { id, name: STEP_TYPE_LABELS[type], retry: { ...baseRetry } };
  switch (type) {
    case "condition":
      return { ...base, type, expression: "" };
    case "create-record":
      return { ...base, type, tableId: "", valuesExpression: "" };
    case "update-record":
      return { ...base, type, tableId: "", recordIdExpression: "", valuesExpression: "" };
    case "assign-to-position":
      return { ...base, type, positionIdExpression: "", recordIdExpression: "" };
    case "send-alert":
      return { ...base, type, alertDefinitionId: "", inputExpression: null };
    case "call-webhook":
      return { ...base, type, url: "https://", method: "POST", bodyExpression: null };
    case "wait":
      return { ...base, type, durationSeconds: 60 };
    case "approval":
      return { ...base, type, approverPositionIds: [], instructions: "" };
    case "escalate":
      return { ...base, type, deadlineExpression: "", targetPositionIds: [] };
    case "plugin-action":
      return { ...base, type, pluginId: "", actionKey: "", inputExpression: null };
  }
}

/** Creates a trigger of the given type with empty config. */
export function createTrigger(type: TriggerType): WorkflowTrigger {
  switch (type) {
    case "record-created":
      return { type, tableId: "" };
    case "record-updated":
      return { type, tableId: "", fieldIds: [] };
    case "schedule":
      return { type, cron: "", timeZone: "UTC" };
    case "incident-activated":
    case "incident-escalated":
      return { type };
    case "inbound-webhook":
      return { type, endpointKey: "" };
    case "form-submitted":
      return { type, viewId: "" };
    case "button-clicked":
      return { type, boardId: "", blockId: "" };
  }
}

/** Removes a step and every edge touching it. */
export function removeStep(
  steps: readonly WorkflowStep[],
  edges: readonly WorkflowEdge[],
  stepId: string,
): { steps: WorkflowStep[]; edges: WorkflowEdge[] } {
  return {
    steps: steps.filter((step) => step.id !== stepId),
    edges: edges.filter((edge) => edge.sourceStepId !== stepId && edge.targetStepId !== stepId),
  };
}

/** Replaces the edge for (source, branch) with a new target, or removes it when target is null. */
export function setConnection(
  edges: readonly WorkflowEdge[],
  sourceStepId: string,
  branch: EdgeBranch,
  targetStepId: string | null,
  newEdgeId: string,
): WorkflowEdge[] {
  const rest = edges.filter((e) => !(e.sourceStepId === sourceStepId && e.branch === branch));
  if (targetStepId === null) return rest;
  return [...rest, { id: newEdgeId, sourceStepId, targetStepId, branch }];
}

export interface GraphIssue {
  readonly code:
    | "missing-step"
    | "duplicate-branch"
    | "invalid-branch"
    | "cycle"
    | "unreachable"
    | "no-entry"
    | "multiple-entries";
  readonly message: string;
  readonly stepId?: string;
}

/** Entry steps are those no edge targets; the trigger feeds them. */
export function entrySteps(
  steps: readonly WorkflowStep[],
  edges: readonly WorkflowEdge[],
): WorkflowStep[] {
  const targeted = new Set(edges.map((e) => e.targetStepId));
  return steps.filter((s) => !targeted.has(s.id));
}

/**
 * Structural validation mirroring the compiler contract (the server remains authoritative).
 * Input: steps and edges. Output: ordered issues; empty means structurally sound.
 */
export function validateGraph(
  steps: readonly WorkflowStep[],
  edges: readonly WorkflowEdge[],
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const edge of edges) {
    const source = byId.get(edge.sourceStepId);
    if (!source || !byId.has(edge.targetStepId)) {
      issues.push({ code: "missing-step", message: `Edge ${edge.id} points at a missing step.` });
      continue;
    }
    const key = `${edge.sourceStepId}:${edge.branch}`;
    if (seen.has(key)) {
      issues.push({
        code: "duplicate-branch",
        stepId: source.id,
        message: `“${source.name}” has more than one “${edge.branch}” connection.`,
      });
    }
    seen.add(key);
    if (!branchesFor(source.type).includes(edge.branch)) {
      issues.push({
        code: "invalid-branch",
        stepId: source.id,
        message: `“${source.name}” cannot use the “${edge.branch}” branch.`,
      });
    }
  }
  if (steps.length === 0) return issues;
  const entries = entrySteps(steps, edges);
  if (entries.length === 0) {
    issues.push({ code: "no-entry", message: "Every step has an incoming connection (cycle)." });
  } else if (entries.length > 1) {
    issues.push({
      code: "multiple-entries",
      message: `The trigger can feed only one first step; ${entries.length} steps have no incoming connection.`,
    });
  }
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.sourceStepId, [
      ...(adjacency.get(edge.sourceStepId) ?? []),
      edge.targetStepId,
    ]);
  }
  const reachable = new Set<string>();
  const queue = entries.map((s) => s.id);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    queue.push(...(adjacency.get(id) ?? []));
  }
  for (const step of steps) {
    if (!reachable.has(step.id)) {
      issues.push({
        code: "unreachable",
        stepId: step.id,
        message: `“${step.name}” cannot be reached from the trigger.`,
      });
    }
  }
  if (hasCycle(steps, adjacency)) {
    issues.push({ code: "cycle", message: "The graph contains a cycle." });
  }
  return issues;
}

function hasCycle(
  steps: readonly WorkflowStep[],
  adjacency: ReadonlyMap<string, string[]>,
): boolean {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const next of adjacency.get(id) ?? []) if (visit(next)) return true;
    state.set(id, 2);
    return false;
  };
  return steps.some((s) => visit(s.id));
}

export interface LaidOutStep {
  readonly step: WorkflowStep;
  /** Distance from the trigger (1 = first step); unreachable steps get the last column. */
  readonly depth: number;
}

/** Orders steps by depth from the entry (stable, cycle-safe) for the column layout and keyboard order. */
export function layoutSteps(
  steps: readonly WorkflowStep[],
  edges: readonly WorkflowEdge[],
): LaidOutStep[] {
  const depth = new Map<string, number>();
  const queue = entrySteps(steps, edges).map((s) => s.id);
  for (const id of queue) depth.set(id, 1);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const edge of edges) {
      if (edge.sourceStepId === id && !depth.has(edge.targetStepId)) {
        depth.set(edge.targetStepId, (depth.get(id) ?? 1) + 1);
        queue.push(edge.targetStepId);
      }
    }
  }
  const fallback = Math.max(1, ...depth.values()) + 1;
  return steps
    .map((step, index) => ({ step, depth: depth.get(step.id) ?? fallback, index }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map(({ step, depth: d }) => ({ step, depth: d }));
}
