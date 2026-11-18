import type { ConnectionAuthContext } from "../auth/context.js";

export type ConnectionState =
  | "authenticating"
  | "authenticated"
  | "reconnecting"
  | "closing"
  | "closed";

export interface ConnectionSnapshot {
  readonly connectionId: string;
  readonly state: ConnectionState;
  readonly auth: ConnectionAuthContext | null;
  readonly connectedAt: Date;
  readonly lastHeartbeatAt: Date | null;
  readonly authorizationRevision: number;
}

export interface ConnectionLifecycle {
  /** Return an immutable snapshot suitable for diagnostics without credentials or payloads. */
  snapshot(): ConnectionSnapshot;
  /** Transition after verified authentication; rejects invalid state and starts heartbeat/expiry timers. */
  authenticated(auth: ConnectionAuthContext): Promise<void>;
  /** Refresh authorization and close if tenant, position, incident, session, or key access was revoked. */
  reauthorize(auth: ConnectionAuthContext): Promise<void>;
  /** Mark heartbeat freshness; stale heartbeats eventually trigger a bounded close. */
  heartbeat(at: Date): void;
  /** Close subscriptions, presence, locks, timers, and socket exactly once with a safe close code. */
  close(code: number, reason: string): Promise<void>;
}

/**
 * TODO(implementation): create the per-socket lifecycle state machine and resource owner.
 * Input: server-generated connection ID and authenticated socket callbacks supplied by the gateway.
 * Output: a ConnectionLifecycle enforcing valid transitions and exactly-once cleanup.
 * Errors: invalid transitions reject safely; cleanup always releases subscriptions/presence/locks.
 * Depends on: authenticator, event subscriptions, presence service, heartbeat timers, and metrics.
 * Security: revalidates before token expiry and on authorization revision changes; logs no credentials.
 */
export function createConnectionLifecycle(_connectionId: string): ConnectionLifecycle {
  throw new Error("TODO(implementation): createConnectionLifecycle");
}
