import type { JobHandler, JobPayloadBase } from "./context.js";

export interface AuditRetentionJobPayload extends JobPayloadBase {
  readonly retentionPolicyVersionId: string;
  readonly partitionMonth: string;
  readonly dryRun: boolean;
}

/**
 * TODO(implementation): enforce tenant audit retention only for expired partitions without legal holds.
 * Input: AuditRetentionJobPayload naming immutable policy version, one month partition, and dry-run mode.
 * Output: a signed retention report or idempotent partition archival/detachment result.
 * Errors: blocks active/held/non-expired partitions and retries transient storage without partial deletion.
 * Depends on: audit partition catalog, legal-hold repository, immutable archive/signing, and audit events.
 * Security: requires scoped system authority; never deletes incident legal records outside approved policy.
 */
export const enforceAuditRetention: JobHandler<AuditRetentionJobPayload> = (_context) => {
  throw new Error("TODO(implementation): enforceAuditRetention");
};
