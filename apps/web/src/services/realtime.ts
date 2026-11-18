import type { AppScope, AuditMetadata, Unsubscribe } from "./contracts.js";

export type WebSocketState = "connecting" | "live" | "reconnecting" | "offline";
export type NatsGatewayState = "unknown" | "connected" | "degraded" | "disconnected";

export interface RealtimeConnectionSnapshot {
  readonly webSocket: WebSocketState;
  readonly natsGateway: NatsGatewayState;
  readonly lastEventAt?: string;
  readonly reconnectAttempt: number;
}

export interface RealtimeConnectRequest {
  readonly scope: AppScope;
  readonly audit: AuditMetadata;
  readonly onSnapshot: (snapshot: RealtimeConnectionSnapshot) => void;
}

export interface ScopedEventEnvelope {
  readonly eventId: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly occurredAt: string;
  readonly payload: unknown;
}

export interface RealtimeConnectionPort {
  readonly connect: (request: RealtimeConnectRequest) => Unsubscribe;
  readonly subscribeAlerts: (
    scope: AppScope,
    listener: (event: ScopedEventEnvelope) => void,
  ) => Unsubscribe;
  readonly getSnapshot: (scope: AppScope) => RealtimeConnectionSnapshot;
}

function realtimeNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): RealtimeConnectionPort.${method}`);
}

/**
 * TODO(implementation): maintain the authenticated WebSocket and expose NATS gateway health.
 * Input: scoped authenticated connect requests and alert listeners.
 * Output: a throwing port; future methods return cleanup functions and freshness snapshots.
 * Errors: all methods throw TODO(implementation); future reconnects replay without missed events.
 * Depends on: apps/realtime, NATS JetStream, session credentials, and Electric polling fallback.
 * Browsers connect only to the scoped gateway, never directly to NATS; subjects and events are
 * validated for tenant/incident scope before delivery and sensitive payloads stay out of logs.
 */
export function createRealtimeConnectionStub(): RealtimeConnectionPort {
  return {
    connect: () => realtimeNotImplemented("connect"),
    subscribeAlerts: () => realtimeNotImplemented("subscribeAlerts"),
    getSnapshot: () => realtimeNotImplemented("getSnapshot"),
  };
}
