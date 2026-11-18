import type { AlertAdapterRegistry } from "@argus/alerts";
import type { TaskList } from "graphile-worker";
import type {
  acknowledgeAlert,
  deliverAlert,
  escalateAlert,
  expireAlertAcknowledgement,
} from "./alerts.js";
import type { enforceAuditRetention } from "./audit.js";
import type { checkFeedRateHealth, deduplicateFeedItem, ingestFeedBatch } from "./feeds.js";
import type { exportRecords, importRecords } from "./transfers.js";
import type { deliverWebhook } from "./webhooks.js";
import type {
  expireWorkflowApproval,
  retryWorkflowStep,
  runWorkflow,
  runWorkflowStep,
} from "./workflows.js";

export interface WorkerJobHandlers {
  readonly runWorkflow: typeof runWorkflow;
  readonly runWorkflowStep: typeof runWorkflowStep;
  readonly retryWorkflowStep: typeof retryWorkflowStep;
  readonly expireWorkflowApproval: typeof expireWorkflowApproval;
  readonly deliverAlert: typeof deliverAlert;
  readonly escalateAlert: typeof escalateAlert;
  readonly acknowledgeAlert: typeof acknowledgeAlert;
  readonly expireAlertAcknowledgement: typeof expireAlertAcknowledgement;
  readonly importRecords: typeof importRecords;
  readonly exportRecords: typeof exportRecords;
  readonly deliverWebhook: typeof deliverWebhook;
  readonly ingestFeedBatch: typeof ingestFeedBatch;
  readonly deduplicateFeedItem: typeof deduplicateFeedItem;
  readonly checkFeedRateHealth: typeof checkFeedRateHealth;
  readonly enforceAuditRetention: typeof enforceAuditRetention;
}

/**
 * TODO(implementation): bind typed payload parsers, infrastructure services, and handlers to job names.
 * Input: alert adapters and database/storage/feed/webhook/audit ports supplied by composition.
 * Output: a WorkerJobHandlers collection covering every JOB_NAMES entry exactly once.
 * Errors: throws at startup for unknown payload versions, missing jobs, or absent mandatory services.
 * Depends on: Zod payload schemas, @argus/alerts, Graphile Worker, and scoped domain repositories.
 * Security: every handler establishes tenant/incident RLS claims and immutable system/actor audit context.
 */
export function createWorkerJobHandlers(_alertAdapters: AlertAdapterRegistry): WorkerJobHandlers {
  throw new Error("TODO(implementation): createWorkerJobHandlers");
}

/**
 * TODO(implementation): adapt the typed handlers into a Graphile Worker TaskList.
 * Input: the complete WorkerJobHandlers collection with stable job-name mappings.
 * Output: TaskList that parses payloads, enforces concurrency/retries, and reports JobResult.
 * Errors: malformed payloads dead-letter without provider effects; infrastructure errors remain retryable.
 * Depends on: Graphile Worker task API and createWorkerJobHandlers.
 * Security: queue payloads are untrusted, size-bounded, versioned, and never contain provider secrets.
 */
export function createWorkerTaskList(_handlers: WorkerJobHandlers): TaskList {
  throw new Error("TODO(implementation): createWorkerTaskList");
}
