import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { ConnectionAuthenticator } from "./auth/context.js";
import type { RealtimeConfig } from "./config/env.js";
import type { ScopedEventBus } from "./events/bus.js";
import type { RealtimeLatencyMetrics } from "./metrics/latency.js";

export interface RealtimeGatewayDependencies {
  readonly config: RealtimeConfig;
  readonly authenticator: ConnectionAuthenticator;
  readonly eventBus: ScopedEventBus;
  readonly metrics: RealtimeLatencyMetrics;
}

export interface RealtimeGateway {
  /** Authenticate and own one socket lifecycle; no application frame is handled before authentication. */
  accept(socket: WebSocket, upgrade: IncomingMessage): Promise<void>;
  /** Stop accepting sockets, close subscriptions/presence/locks, and drain within a bounded timeout. */
  close(): Promise<void>;
}

/**
 * TODO(implementation): compose the authenticated WebSocket gateway and per-connection services.
 * Input: validated config, API authenticator, scoped event bus, and latency metrics.
 * Output: a RealtimeGateway handling protocol, lifecycle, presence, alerts, backfill, and health.
 * Errors: rejects unauthenticated upgrades and closes malformed/rate-limited connections safely.
 * Depends on: ws, NATS JetStream, presence/recovery/fan-out factories, and OpenTelemetry.
 * Security: enforces tenant/incident scopes, current RLS/FLS authorization, payload limits, and audit.
 */
export function createRealtimeGateway(_dependencies: RealtimeGatewayDependencies): RealtimeGateway {
  throw new Error("TODO(implementation): createRealtimeGateway");
}

/**
 * TODO(implementation): validate configuration, start HTTP upgrade/health listeners, and handle signals.
 * Input: raw process environment supplied by main or a test harness.
 * Output: resolves after graceful gateway shutdown and dependency cleanup.
 * Errors: throws redacted startup errors and closes partially initialized resources.
 * Depends on: parseRealtimeEnvironment, authenticator/event-bus/metric factories, and createRealtimeGateway.
 * Security: no plaintext production listener, wildcard origin, unscoped NATS credential, or token logging.
 */
export function startRealtime(
  _environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  throw new Error("TODO(implementation): startRealtime");
}
