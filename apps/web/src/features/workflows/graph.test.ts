import type { WorkflowEdge, WorkflowStep } from "@argus/schema";
import { workflowStepSchema } from "@argus/schema";
import { describe, expect, it } from "vitest";
import { parseSampleRecord } from "./dry-run-panel.js";
import { formatDuration, relativeAge } from "./format.js";
import {
  branchesFor,
  createStep,
  layoutSteps,
  removeStep,
  setConnection,
  validateGraph,
} from "./graph.js";

// TEST FIXTURES ONLY — synthetic ids, never shown as operational data.
const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const wait = (n: number): WorkflowStep =>
  ({ ...createStep("wait", id(n)), name: `step ${n}` }) as WorkflowStep;
const edge = (
  n: number,
  from: number,
  to: number,
  branch: WorkflowEdge["branch"] = "next",
): WorkflowEdge => ({
  id: id(100 + n),
  sourceStepId: id(from),
  targetStepId: id(to),
  branch,
});

describe("createStep", () => {
  it("produces a valid wait step and schema-invalid empty condition drafts", () => {
    expect(workflowStepSchema.safeParse(createStep("wait", id(1))).success).toBe(true);
    expect(workflowStepSchema.safeParse(createStep("condition", id(2))).success).toBe(false);
  });
});

describe("branchesFor", () => {
  it("gives conditions true/false and approvals approved/rejected", () => {
    expect(branchesFor("condition")).toContain("true");
    expect(branchesFor("approval")).toContain("rejected");
    expect(branchesFor("wait")).toEqual(["next", "failed"]);
  });
});

describe("validateGraph", () => {
  it("accepts a linear chain", () => {
    expect(validateGraph([wait(1), wait(2)], [edge(1, 1, 2)])).toEqual([]);
  });

  it("reports multiple entry points and unreachable-by-trigger steps", () => {
    const issues = validateGraph([wait(1), wait(2)], []);
    expect(issues.map((i) => i.code)).toContain("multiple-entries");
  });

  it("detects cycles", () => {
    const issues = validateGraph(
      [wait(1), wait(2), wait(3)],
      [edge(1, 2, 3), edge(2, 3, 2), edge(3, 1, 2)],
    );
    expect(issues.map((i) => i.code)).toContain("cycle");
  });

  it("flags edges to missing steps, duplicate and invalid branches", () => {
    expect(validateGraph([wait(1)], [edge(1, 1, 9)]).map((i) => i.code)).toContain("missing-step");
    expect(
      validateGraph([wait(1), wait(2)], [edge(1, 1, 2), edge(2, 1, 2)]).map((i) => i.code),
    ).toContain("duplicate-branch");
    expect(validateGraph([wait(1), wait(2)], [edge(1, 1, 2, "true")]).map((i) => i.code)).toContain(
      "invalid-branch",
    );
  });
});

describe("graph edits", () => {
  it("removeStep drops touching edges", () => {
    const result = removeStep([wait(1), wait(2)], [edge(1, 1, 2)], id(2));
    expect(result.steps).toHaveLength(1);
    expect(result.edges).toEqual([]);
  });

  it("setConnection replaces the same source/branch and removes on null", () => {
    const once = setConnection([edge(1, 1, 2)], id(1), "next", id(3), id(200));
    expect(once).toHaveLength(1);
    expect(once[0]?.targetStepId).toBe(id(3));
    expect(setConnection(once, id(1), "next", null, id(201))).toEqual([]);
  });

  it("layoutSteps orders by depth from the entry step", () => {
    const laid = layoutSteps([wait(3), wait(2), wait(1)], [edge(1, 1, 2), edge(2, 2, 3)]);
    expect(laid.map((l) => [l.step.name, l.depth])).toEqual([
      ["step 1", 1],
      ["step 2", 2],
      ["step 3", 3],
    ]);
  });
});

describe("dry-run sample parsing and formatting", () => {
  it("accepts objects only", () => {
    expect(parseSampleRecord('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseSampleRecord("[]").ok).toBe(false);
    expect(parseSampleRecord("{").ok).toBe(false);
  });

  it("formats relative age and durations", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    expect(relativeAge(new Date("2026-01-01T00:07:00Z"), now)).toBe("3 min ago");
    expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:02Z")).toBe("2.0 s");
    expect(formatDuration("2026-01-01T00:00:00Z", null)).toBeNull();
  });
});
