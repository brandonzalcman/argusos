import type { JobHandler, JobPayloadBase } from "./context.js";

export interface FeedIngestJobPayload extends JobPayloadBase {
  readonly feedId: string;
  readonly feedCursor: string | null;
  readonly mappingDefinitionVersionId: string;
  readonly batchObjectId: string;
}

export interface FeedDedupeJobPayload extends JobPayloadBase {
  readonly feedId: string;
  readonly sourceItemId: string;
  readonly sourceUpdatedAt: string | null;
  readonly payloadHash: string;
  readonly batchObjectId: string;
}

export interface FeedRateHealthJobPayload extends JobPayloadBase {
  readonly feedId: string;
  readonly windowStartedAt: string;
  readonly windowDurationMs: number;
}

/**
 * TODO(implementation): ingest one bounded external feed batch through its immutable field mapping.
 * Input: FeedIngestJobPayload with durable source cursor, quarantined batch, and mapping version.
 * Output: normalized dedupe jobs and a resumable source cursor with feed health/audit progress.
 * Errors: malformed items are quarantined; rate limits/backpressure retry without advancing past data loss.
 * Depends on: MQTT/HTTP/CAP/AVL adapters, object storage, mapping validators, and JetStream outbox.
 * Security: authenticates sources, limits bytes/rate, treats content as untrusted, and isolates tenants.
 */
export const ingestFeedBatch: JobHandler<FeedIngestJobPayload> = (_context) => {
  throw new Error("TODO(implementation): ingestFeedBatch");
};

/**
 * TODO(implementation): atomically deduplicate one source item and apply its authorized mapped mutation.
 * Input: FeedDedupeJobPayload with stable feed/source identity and canonical payload hash.
 * Output: completed duplicate/applied result and optional latest-position live event reference.
 * Errors: hash/source conflicts are audited; transient writes retry without duplicate physical records.
 * Depends on: feed dedupe table, field mapping, RLS/FLS repositories, time-series partitions, and outbox.
 * Security: source IDs cannot select another tenant/table/incident or override server audit columns.
 */
export const deduplicateFeedItem: JobHandler<FeedDedupeJobPayload> = (_context) => {
  throw new Error("TODO(implementation): deduplicateFeedItem");
};

/**
 * TODO(implementation): evaluate feed rate, lag, error, and freshness health for one time window.
 * Input: FeedRateHealthJobPayload identifying one feed and bounded aggregation window.
 * Output: durable rate/health status and idempotent operator alert references when thresholds breach.
 * Errors: missing windows degrade health explicitly; metrics storage failures retry with backoff.
 * Depends on: feed metrics, per-feed limits, health repository, alert jobs, and OpenTelemetry.
 * Security: health payloads exclude raw sensor content, credentials, tokens, and sensitive locations.
 */
export const checkFeedRateHealth: JobHandler<FeedRateHealthJobPayload> = (_context) => {
  throw new Error("TODO(implementation): checkFeedRateHealth");
};
