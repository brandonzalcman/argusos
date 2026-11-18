import type { ConnectionAuthContext } from "../auth/context.js";
import type { EventEnvelope, ScopedEventBus } from "../events/bus.js";
import type { RealtimeLatencyMetrics } from "../metrics/latency.js";

export interface AlertFanoutResult {
  readonly delivered: boolean;
  readonly duplicate: boolean;
  readonly renderedAt: Date | null;
}

export interface AlertFanoutService {
  /**
   * Filter and fan out one durable alert event to currently authorized connections.
   * Input: verified recipient connection scope and an event fetched from the scoped alert subject.
   * Output: delivery/duplicate status for metrics; acknowledgement remains a separate audited API call.
   * Errors: drops forbidden/malformed events with redacted metrics and propagates transient bus failures.
   * Depends on: alert recipient policy, tenant/incident membership, FLS, and bounded socket backpressure.
   */
  fanout(context: ConnectionAuthContext, event: EventEnvelope): Promise<AlertFanoutResult>;
}

/**
 * TODO(implementation): create alert fan-out over scoped subscriptions and per-connection authorization.
 * Input: alert subscription/registry ports supplied by the gateway composition root.
 * Output: an AlertFanoutService meeting alert-to-visible latency instrumentation requirements.
 * Errors: throws for missing recipient authorization or fan-out infrastructure at composition time.
 * Depends on: NATS JetStream, connection registry, alert API policy, and latency metrics.
 * Security: revocation stops both new and replayed alerts; payloads never bypass field-level security.
 */
export function createAlertFanoutService(
  _eventBus: ScopedEventBus,
  _metrics: RealtimeLatencyMetrics,
): AlertFanoutService {
  throw new Error("TODO(implementation): createAlertFanoutService");
}
