import type { WorkflowDefinition, WorkflowEdge, WorkflowRun, WorkflowStep } from "@argus/schema";
import {
  type WorkflowDryRunRequest,
  type WorkflowDryRunResult,
  type WorkflowDryRunStep,
  type WorkflowServicePort,
  WorkflowVersionConflictError,
} from "../features/workflows/workflow-service.js";
import {
  DEMO_INCIDENTS,
  DEMO_POSITIONS,
  DEMO_TABLES,
  DEMO_TENANT_ID,
  DEMO_USERS,
  DEMO_WORKFLOWS,
  demoDelay,
  minutesAgo,
} from "./scenario.js";

const ADMIN_ID = DEMO_USERS.priyaShah;
const retry = { maximumAttempts: 3, backoffSeconds: 30 } as const;

/** Fictional alert definition ids (alert catalog is owned by the alerts demo adapter). */
const ALERT_DEFS = {
  logisticsEscalation: "b1000000-0000-4000-8000-000000000001",
  shelterCapacity: "b1000000-0000-4000-8000-000000000002",
  shelterCapacityPio: "b1000000-0000-4000-8000-000000000003",
  dailySitrep: "b1000000-0000-4000-8000-000000000004",
} as const;

const stepId = (workflow: number, n: number): string =>
  `c${workflow}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const edgeId = (workflow: number, n: number): string =>
  `d${workflow}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function edge(
  workflow: number,
  n: number,
  from: number,
  to: number,
  branch: WorkflowEdge["branch"],
): WorkflowEdge {
  return {
    id: edgeId(workflow, n),
    sourceStepId: stepId(workflow, from),
    targetStepId: stepId(workflow, to),
    branch,
  };
}

// Workflow 1: escalate critical resource requests ---------------------------------------------

const escalateSteps = [
  {
    id: stepId(1, 1),
    name: "Priority is Critical",
    type: "condition",
    retry,
    expression: 'record.priority == "Critical"',
  },
  {
    id: stepId(1, 2),
    name: "Alert Logistics Section Chief",
    type: "send-alert",
    retry,
    alertDefinitionId: ALERT_DEFS.logisticsEscalation,
    inputExpression: '{"requestId": record.id, "item": record.item, "quantity": record.quantity}',
  },
  { id: stepId(1, 3), name: "Wait 15 minutes", type: "wait", retry, durationSeconds: 900 },
  {
    id: stepId(1, 4),
    name: "Incident Commander approval",
    type: "approval",
    retry,
    approverPositionIds: [DEMO_POSITIONS.incidentCommander],
    instructions: "Approve expedited procurement for this critical resource request.",
  },
  {
    id: stepId(1, 5),
    name: "Mark request expedited",
    type: "update-record",
    retry,
    tableId: DEMO_TABLES.resourceRequests,
    recordIdExpression: "record.id",
    valuesExpression: '{"status": "Expedited"}',
  },
] satisfies WorkflowStep[];

const ESCALATE: WorkflowDefinition = {
  id: DEMO_WORKFLOWS.escalateCriticalRequest,
  tenantId: DEMO_TENANT_ID,
  version: 4,
  lifecycle: "published",
  changeSummary: "Add commander approval before expediting",
  createdAt: minutesAgo(60 * 24 * 40),
  createdBy: ADMIN_ID,
  createdPositionId: DEMO_POSITIONS.incidentCommander,
  publishedAt: minutesAgo(60 * 24 * 6),
  publishedBy: ADMIN_ID,
  name: "Escalate critical resource request",
  description:
    "When a resource request is created or updated with Critical priority, alert Logistics and require commander approval to expedite.",
  enabled: true,
  incidentScope: "incident",
  trigger: {
    type: "record-updated",
    tableId: DEMO_TABLES.resourceRequests,
    fieldIds: [],
  },
  steps: escalateSteps,
  edges: [
    edge(1, 1, 1, 2, "true"),
    edge(1, 2, 2, 3, "next"),
    edge(1, 3, 3, 4, "next"),
    edge(1, 4, 4, 5, "approved"),
  ],
  runPositionIds: [DEMO_POSITIONS.incidentCommander, DEMO_POSITIONS.logisticsChief],
};

// Workflow 2: shelter capacity alert -------------------------------------------------------------

const shelterSteps = [
  {
    id: stepId(2, 1),
    name: "Occupancy above 90%",
    type: "condition",
    retry,
    expression: "double(record.occupancy) / double(record.capacity) > 0.9",
  },
  {
    id: stepId(2, 2),
    name: "Alert Shelter Manager",
    type: "send-alert",
    retry,
    alertDefinitionId: ALERT_DEFS.shelterCapacity,
    inputExpression: '{"shelter": record.name, "occupancy": record.occupancy}',
  },
  {
    id: stepId(2, 3),
    name: "Alert Public Information Officer",
    type: "send-alert",
    retry,
    alertDefinitionId: ALERT_DEFS.shelterCapacityPio,
    inputExpression: '{"shelter": record.name, "capacity": record.capacity}',
  },
] satisfies WorkflowStep[];

const SHELTER: WorkflowDefinition = {
  id: DEMO_WORKFLOWS.shelterCapacityAlert,
  tenantId: DEMO_TENANT_ID,
  version: 2,
  lifecycle: "published",
  changeSummary: "Notify the PIO when a shelter nears capacity",
  createdAt: minutesAgo(60 * 24 * 25),
  createdBy: ADMIN_ID,
  createdPositionId: DEMO_POSITIONS.incidentCommander,
  publishedAt: minutesAgo(60 * 24 * 3),
  publishedBy: ADMIN_ID,
  name: "Shelter capacity alert",
  description:
    "Alerts the Shelter Manager and Public Information Officer when a shelter exceeds 90% occupancy.",
  enabled: true,
  incidentScope: "incident",
  trigger: { type: "record-updated", tableId: DEMO_TABLES.shelters, fieldIds: [] },
  steps: shelterSteps,
  edges: [edge(2, 1, 1, 2, "true"), edge(2, 2, 2, 3, "next")],
  runPositionIds: [DEMO_POSITIONS.shelterManager, DEMO_POSITIONS.incidentCommander],
};

// Workflow 3: daily situation report (draft, not yet enabled) ---------------------------------

const sitrepSteps = [
  {
    id: stepId(3, 1),
    name: "Record daily situation report",
    type: "create-record",
    retry,
    tableId: DEMO_TABLES.significantEvents,
    valuesExpression: '{"title": "Daily situation report", "category": "Report"}',
  },
  {
    id: stepId(3, 2),
    name: "Notify Planning Section",
    type: "send-alert",
    retry,
    alertDefinitionId: ALERT_DEFS.dailySitrep,
    inputExpression: null,
  },
] satisfies WorkflowStep[];

const SITREP: WorkflowDefinition = {
  id: DEMO_WORKFLOWS.dailySituationReport,
  tenantId: DEMO_TENANT_ID,
  version: 2,
  lifecycle: "draft",
  changeSummary: "Draft: waiting on Planning to confirm report time",
  createdAt: minutesAgo(60 * 24 * 10),
  createdBy: DEMO_USERS.jordanLee,
  createdPositionId: DEMO_POSITIONS.planningChief,
  publishedAt: null,
  publishedBy: null,
  name: "Daily situation report",
  description: "Creates the daily situation report record at 06:00 and notifies Planning.",
  enabled: false,
  incidentScope: "incident",
  trigger: { type: "schedule", cron: "0 6 * * *", timeZone: "America/Los_Angeles" },
  steps: sitrepSteps,
  edges: [edge(3, 1, 1, 2, "next")],
  runPositionIds: [DEMO_POSITIONS.planningChief],
};

// Runs --------------------------------------------------------------------------------------------

type RunStatus = WorkflowRun["status"];

interface RunSpec {
  readonly status: RunStatus;
  readonly startedMinutesAgo: number;
  readonly durationSeconds: number | null;
  readonly startedBy: string | null;
  readonly position: string | null;
  /** How many steps completed before the run stopped. */
  readonly completedSteps: number;
  readonly note: string;
  readonly trigger: Readonly<Record<string, string | number>>;
}

function buildRuns(workflow: WorkflowDefinition, index: number, specs: readonly RunSpec[]) {
  return specs.map((spec, n): WorkflowRun => {
    const stepResults = workflow.steps.map((step, i) => {
      let status = "skipped";
      if (i < spec.completedSteps) status = "executed";
      else if (i === spec.completedSteps) {
        if (spec.status === "failed") status = "failed";
        else if (spec.status === "waiting") status = "waiting";
        else if (spec.status === "running") status = "running";
        else if (spec.status === "cancelled") status = "cancelled";
      }
      return { stepId: step.id, name: step.name, status };
    });
    const started = minutesAgo(spec.startedMinutesAgo);
    return {
      id: `e${index}000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
      tenantId: DEMO_TENANT_ID,
      incidentId: DEMO_INCIDENTS.harlowFlood,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: spec.status,
      startedBy: spec.startedBy,
      startedPositionId: spec.position,
      startedAt: started,
      completedAt:
        spec.durationSeconds === null
          ? null
          : new Date(new Date(started).getTime() + spec.durationSeconds * 1000).toISOString(),
      context: { trigger: { ...spec.trigger }, note: spec.note, stepResults },
    };
  });
}

const ESCALATE_RUNS = buildRuns(ESCALATE, 1, [
  {
    status: "waiting",
    startedMinutesAgo: 9,
    durationSeconds: null,
    startedBy: null,
    position: null,
    completedSteps: 3,
    note: "Awaiting Incident Commander approval.",
    trigger: { event: "record-updated", request: "RR-1042" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 95,
    durationSeconds: 1140,
    startedBy: null,
    position: null,
    completedSteps: 5,
    note: "Approved and marked expedited.",
    trigger: { event: "record-updated", request: "RR-1031" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 210,
    durationSeconds: 1320,
    startedBy: null,
    position: null,
    completedSteps: 5,
    note: "Approved and marked expedited.",
    trigger: { event: "record-updated", request: "RR-1027" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 330,
    durationSeconds: 2,
    startedBy: null,
    position: null,
    completedSteps: 1,
    note: "Priority was High; condition false, nothing to do.",
    trigger: { event: "record-updated", request: "RR-1022" },
  },
  {
    status: "failed",
    startedMinutesAgo: 480,
    durationSeconds: 95,
    startedBy: null,
    position: null,
    completedSteps: 1,
    note: "Alert delivery failed after 3 attempts: SMS gateway timeout.",
    trigger: { event: "record-updated", request: "RR-1018" },
  },
  {
    status: "cancelled",
    startedMinutesAgo: 700,
    durationSeconds: 400,
    startedBy: DEMO_USERS.alexMorgan,
    position: DEMO_POSITIONS.incidentCommander,
    completedSteps: 2,
    note: "Cancelled by Incident Commander; request withdrawn.",
    trigger: { event: "manual", request: "RR-1011" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 1300,
    durationSeconds: 960,
    startedBy: null,
    position: null,
    completedSteps: 5,
    note: "Approved and marked expedited.",
    trigger: { event: "record-updated", request: "RR-0994" },
  },
]);

const SHELTER_RUNS = buildRuns(SHELTER, 2, [
  {
    status: "succeeded",
    startedMinutesAgo: 22,
    durationSeconds: 4,
    startedBy: null,
    position: null,
    completedSteps: 3,
    note: "Riverside Community Centre at 93% occupancy; alerts sent.",
    trigger: { event: "record-updated", shelter: "Riverside Community Centre" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 140,
    durationSeconds: 1,
    startedBy: null,
    position: null,
    completedSteps: 1,
    note: "Occupancy below threshold; no alert.",
    trigger: { event: "record-updated", shelter: "Eastfield High School" },
  },
  {
    status: "retrying",
    startedMinutesAgo: 3,
    durationSeconds: null,
    startedBy: null,
    position: null,
    completedSteps: 1,
    note: "Retrying alert to Shelter Manager (attempt 2 of 3).",
    trigger: { event: "record-updated", shelter: "Northbank Arena" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 380,
    durationSeconds: 5,
    startedBy: null,
    position: null,
    completedSteps: 3,
    note: "Northbank Arena at 96% occupancy; alerts sent.",
    trigger: { event: "record-updated", shelter: "Northbank Arena" },
  },
  {
    status: "failed",
    startedMinutesAgo: 600,
    durationSeconds: 70,
    startedBy: null,
    position: null,
    completedSteps: 2,
    note: "PIO alert failed: recipient has no reachable channel.",
    trigger: { event: "record-updated", shelter: "Hillcrest Church Hall" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 900,
    durationSeconds: 1,
    startedBy: null,
    position: null,
    completedSteps: 1,
    note: "Occupancy below threshold; no alert.",
    trigger: { event: "record-updated", shelter: "Riverside Community Centre" },
  },
]);

const SITREP_RUNS = buildRuns(SITREP, 3, [
  {
    status: "succeeded",
    startedMinutesAgo: 60 * 12,
    durationSeconds: 6,
    startedBy: DEMO_USERS.jordanLee,
    position: DEMO_POSITIONS.planningChief,
    completedSteps: 2,
    note: "Manual test run of the draft: report record created and Planning notified.",
    trigger: { event: "manual" },
  },
  {
    status: "failed",
    startedMinutesAgo: 60 * 36,
    durationSeconds: 12,
    startedBy: DEMO_USERS.jordanLee,
    position: DEMO_POSITIONS.planningChief,
    completedSteps: 0,
    note: "Test run failed: required field 'summary' missing from values expression.",
    trigger: { event: "manual" },
  },
  {
    status: "succeeded",
    startedMinutesAgo: 60 * 60,
    durationSeconds: 5,
    startedBy: DEMO_USERS.jordanLee,
    position: DEMO_POSITIONS.planningChief,
    completedSteps: 2,
    note: "Manual test run completed.",
    trigger: { event: "manual" },
  },
  {
    status: "cancelled",
    startedMinutesAgo: 60 * 84,
    durationSeconds: 2,
    startedBy: DEMO_USERS.jordanLee,
    position: DEMO_POSITIONS.planningChief,
    completedSteps: 0,
    note: "Cancelled while editing.",
    trigger: { event: "manual" },
  },
  {
    status: "queued",
    startedMinutesAgo: 1,
    durationSeconds: null,
    startedBy: DEMO_USERS.jordanLee,
    position: DEMO_POSITIONS.planningChief,
    completedSteps: 0,
    note: "Queued for a worker.",
    trigger: { event: "manual" },
  },
]);

const RUNS_BY_WORKFLOW: Readonly<Record<string, readonly WorkflowRun[]>> = {
  [ESCALATE.id]: ESCALATE_RUNS,
  [SHELTER.id]: SHELTER_RUNS,
  [SITREP.id]: SITREP_RUNS,
};

// Dry run -----------------------------------------------------------------------------------------

function describeStep(step: WorkflowStep): string {
  switch (step.type) {
    case "condition":
      return `Evaluated ${step.expression}`;
    case "send-alert":
      return "Would send the alert (suppressed in dry run).";
    case "wait":
      return `Would wait ${step.durationSeconds} seconds.`;
    case "approval":
      return "Would pause for approval from the configured positions.";
    case "update-record":
      return "Would update the matching record (suppressed in dry run).";
    case "create-record":
      return "Would create a record (suppressed in dry run).";
    case "call-webhook":
      return `Would call ${step.url} (suppressed in dry run).`;
    case "assign-to-position":
      return "Would assign the record (suppressed in dry run).";
    case "escalate":
      return "Would escalate to the target positions (suppressed in dry run).";
    case "plugin-action":
      return `Would run plugin action ${step.actionKey} (suppressed in dry run).`;
  }
}

/** Evaluates simple `field == "value"` conditions against the sample; other expressions pass. */
function evaluateCondition(expression: string, sample: Readonly<Record<string, unknown>>): boolean {
  const match = /(?:record\.)?(\w+)\s*==\s*"([^"]*)"/.exec(expression);
  if (!match) return true;
  const [, field, expected] = match;
  return field !== undefined && String(sample[field]) === expected;
}

function runDryRun(
  workflow: WorkflowDefinition,
  request: WorkflowDryRunRequest,
): WorkflowDryRunResult {
  const byId = new Map(workflow.steps.map((s) => [s.id, s]));
  const targeted = new Set(workflow.edges.map((e) => e.targetStepId));
  const steps: WorkflowDryRunStep[] = [];
  const visited = new Set<string>();
  let current = workflow.steps.find((s) => !targeted.has(s.id));
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    let branch: WorkflowEdge["branch"] = "next";
    if (current.type === "condition") {
      branch = evaluateCondition(current.expression, request.sampleRecord) ? "true" : "false";
    } else if (current.type === "approval") {
      branch = "approved";
    }
    const status: WorkflowDryRunStep["status"] =
      current.type === "wait" || current.type === "approval" ? "would-wait" : "executed";
    steps.push({
      stepId: current.id,
      status,
      branchTaken: branch,
      detail:
        current.type === "condition"
          ? `${describeStep(current)} -> ${branch}`
          : describeStep(current),
      durationMs: 8 + steps.length * 11,
    });
    const currentId = current.id;
    const nextEdge = workflow.edges.find(
      (e) => e.sourceStepId === currentId && e.branch === branch,
    );
    current = nextEdge ? byId.get(nextEdge.targetStepId) : undefined;
  }
  for (const step of workflow.steps) {
    if (!visited.has(step.id)) {
      steps.push({
        stepId: step.id,
        status: "skipped",
        branchTaken: null,
        detail: "Not reached for this sample record.",
        durationMs: 0,
      });
    }
  }
  return {
    outcome: "succeeded",
    evaluatedDefinitionVersion: request.definitionVersion,
    steps,
    sideEffectsSuppressed: true,
  };
}

/**
 * In-memory workflow service for demo mode. saveDraft honors optimistic versioning: a stale
 * expectedVersion throws WorkflowVersionConflictError with the current in-memory definition.
 */
export function createDemoWorkflowService(): WorkflowServicePort {
  const workflows = new Map<string, WorkflowDefinition>(
    [ESCALATE, SHELTER, SITREP].map((workflow) => [workflow.id, workflow]),
  );

  return {
    listWorkflows: () => demoDelay([...workflows.values()]),
    getWorkflow: (_scope, workflowId) => demoDelay(workflows.get(workflowId) ?? null),
    listRuns: (_scope, workflowId) => demoDelay(RUNS_BY_WORKFLOW[workflowId] ?? []),
    saveDraft: async (request) => {
      const current = workflows.get(request.definition.id);
      if (current && request.expectedVersion !== current.version) {
        throw new WorkflowVersionConflictError(current);
      }
      const saved: WorkflowDefinition = {
        ...request.definition,
        version: (current?.version ?? 0) + 1,
        lifecycle: "draft",
      };
      workflows.set(saved.id, saved);
      return demoDelay(saved, 350);
    },
    dryRun: async (request) => {
      const workflow = workflows.get(request.workflowId);
      if (!workflow) throw new Error("Workflow not found.");
      return demoDelay(runDryRun(workflow, request), 600);
    },
  };
}
