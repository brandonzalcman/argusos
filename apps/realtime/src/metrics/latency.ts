import type { Meter } from "@opentelemetry/api";

export interface LatencyObservationScope {
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly stream: "incident-events" | "alerts" | "presence";
}

export interface RealtimeLatencyMetrics {
  /** Observe commit-to-client-visible latency in milliseconds with low-cardinality, non-sensitive labels. */
  observeCommitToVisible(scope: LatencyObservationScope, milliseconds: number): void;
  /** Observe alert-raised-to-in-app/push latency; never label with user, recipient, or alert content. */
  observeAlertDelivery(scope: LatencyObservationScope, milliseconds: number): void;
  /** Observe full reconnect/backfill duration and outcome for reliability SLOs. */
  observeReconnect(
    scope: LatencyObservationScope,
    milliseconds: number,
    outcome: "complete" | "failed",
  ): void;
}

/**
 * TODO(implementation): create OpenTelemetry realtime histograms and exemplar propagation.
 * Input: the application meter and low-cardinality deployment labels supplied by composition.
 * Output: RealtimeLatencyMetrics for p95/p99 commit-visible, alert, and reconnect targets.
 * Errors: invalid negative/non-finite observations are rejected without interrupting delivery.
 * Depends on: OpenTelemetry metrics, trace context, and client rendered-at reports.
 * Security: no raw tenant/user IDs, record IDs, alert content, tokens, or payloads in metric labels/exemplars.
 */
export function createRealtimeLatencyMetrics(_meter: Meter): RealtimeLatencyMetrics {
  throw new Error("TODO(implementation): createRealtimeLatencyMetrics");
}
