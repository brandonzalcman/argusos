export interface JobPayloadBase {
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly initiatedByUserId: string | null;
  readonly initiatedByPositionId: string | null;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly enqueuedAt: string;
}

export interface JobContext<TPayload extends JobPayloadBase> {
  readonly payload: TPayload;
  readonly jobId: string;
  readonly attempt: number;
  readonly maximumAttempts: number;
  readonly signal: AbortSignal;
}

export type JobResult =
  | { readonly status: "completed"; readonly completedAt: Date }
  | { readonly status: "retry"; readonly retryAt: Date; readonly safeReason: string }
  | { readonly status: "waiting"; readonly resumeAt: Date | null; readonly safeReason: string }
  | { readonly status: "dead-letter"; readonly safeReason: string };

export type JobHandler<TPayload extends JobPayloadBase> = (
  context: JobContext<TPayload>,
) => Promise<JobResult>;

export const JOB_NAMES = [
  "workflow.run",
  "workflow.step",
  "workflow.retry",
  "workflow.approval-expiry",
  "alert.deliver",
  "alert.escalate",
  "alert.acknowledge",
  "alert.acknowledgement-expiry",
  "import.execute",
  "export.execute",
  "webhook.deliver",
  "feed.ingest",
  "feed.dedupe",
  "feed.rate-health",
  "audit.retention",
] as const;

export type JobName = (typeof JOB_NAMES)[number];
