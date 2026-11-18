import type { JobHandler, JobPayloadBase } from "./context.js";

export interface WorkflowRunJobPayload extends JobPayloadBase {
  readonly workflowRunId: string;
  readonly workflowDefinitionVersionId: string;
  readonly triggerEventId: string;
}

export interface WorkflowStepJobPayload extends JobPayloadBase {
  readonly workflowRunId: string;
  readonly workflowStepRunId: string;
  readonly stepKey: string;
  readonly stepAttempt: number;
}

export interface WorkflowRetryJobPayload extends WorkflowStepJobPayload {
  readonly failedJobId: string;
  readonly failureCode: string;
}

export interface WorkflowApprovalExpiryJobPayload extends JobPayloadBase {
  readonly workflowRunId: string;
  readonly workflowStepRunId: string;
  readonly approvalId: string;
  readonly deadlineAt: string;
}

/**
 * TODO(implementation): start or resume a durable workflow run from an immutable published definition.
 * Input: versioned WorkflowRunJobPayload and Graphile attempt/cancellation context.
 * Output: completed/waiting/retry/dead-letter result with durable run state and scheduled next steps.
 * Errors: invalid definitions dead-letter safely; transient storage failures retry without duplicate triggers.
 * Depends on: workflow repositories, trigger event log, transaction outbox, and Graphile Worker.
 * Security: revalidates tenant/incident actor capabilities and writes every transition to immutable audit.
 */
export const runWorkflow: JobHandler<WorkflowRunJobPayload> = (_context) => {
  throw new Error("TODO(implementation): runWorkflow");
};

/**
 * TODO(implementation): execute one typed workflow step and persist its input/output references atomically.
 * Input: WorkflowStepJobPayload identifying one run, step, attempt, and idempotency scope.
 * Output: next-step/wait/retry/dead-letter result with bounded redacted step logs.
 * Errors: maps condition/action failures to workflow policy; cancellations checkpoint before exit.
 * Depends on: workflow definition registry, record/alert/webhook/plugin ports, and idempotency storage.
 * Security: steps execute with their original scoped actor, never elevated ambient worker permissions.
 */
export const runWorkflowStep: JobHandler<WorkflowStepJobPayload> = (_context) => {
  throw new Error("TODO(implementation): runWorkflowStep");
};

/**
 * TODO(implementation): retry a failed step using bounded exponential backoff and idempotent effects.
 * Input: WorkflowRetryJobPayload linking the failed job and stable step attempt identity.
 * Output: a retry result or a new durable step attempt; permanent failures dead-letter with audit.
 * Errors: rejects attempts beyond policy and avoids duplicating non-idempotent external side effects.
 * Depends on: retry policy, provider idempotency records, step repository, and monotonic scheduling.
 * Security: failure logs contain no secrets, record payloads, tokens, or sensitive field values.
 */
export const retryWorkflowStep: JobHandler<WorkflowRetryJobPayload> = (_context) => {
  throw new Error("TODO(implementation): retryWorkflowStep");
};

/**
 * TODO(implementation): expire or escalate a human approval that reached its durable deadline.
 * Input: WorkflowApprovalExpiryJobPayload for one scoped approval and workflow step.
 * Output: waiting result when already decided, otherwise the configured timeout/escalation transition.
 * Errors: retries storage races; stale expiry jobs cannot override a later human decision.
 * Depends on: approval optimistic versions, workflow state machine, alert escalation, and audit.
 * Security: only authorized approvers can decide; expiry jobs cannot approve on a user's behalf.
 */
export const expireWorkflowApproval: JobHandler<WorkflowApprovalExpiryJobPayload> = (_context) => {
  throw new Error("TODO(implementation): expireWorkflowApproval");
};
