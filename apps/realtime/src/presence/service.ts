import type { ConnectionAuthContext } from "../auth/context.js";
import type { ScopedEventBus } from "../events/bus.js";

export interface PresencePolicy {
  readonly presenceTtlMs: number;
  readonly softLockTtlMs: number;
  readonly maximumHeartbeatBytes: number;
}

export interface PresenceLocation {
  readonly incidentId: string;
  readonly boardId: string | null;
  readonly tableId: string | null;
  readonly recordId: string | null;
}

export interface PresenceEntry {
  readonly userId: string;
  readonly positionId: string;
  readonly connectionId: string;
  readonly location: PresenceLocation;
  readonly expiresAt: Date;
}

export interface EditingLock {
  readonly tenantId: string;
  readonly incidentId: string;
  readonly tableId: string;
  readonly recordId: string;
  readonly fieldId: string | null;
  readonly ownerUserId: string;
  readonly ownerPositionId: string;
  readonly ownerConnectionId: string;
  readonly expiresAt: Date;
}

export interface PresenceService {
  /** Upsert one scoped TTL presence heartbeat after incident/board/record read authorization. */
  heartbeat(context: ConnectionAuthContext, location: PresenceLocation): Promise<void>;
  /** List visible presence for an authorized incident/location without exposing other tenants. */
  list(
    context: ConnectionAuthContext,
    location: PresenceLocation,
  ): Promise<readonly PresenceEntry[]>;
  /** Remove one connection's presence during close/logout; cleanup is idempotent. */
  removeConnection(context: ConnectionAuthContext): Promise<void>;
  /** Acquire/refresh a soft editing signal; it never blocks writes and always has a short TTL. */
  acquireSoftLock(
    context: ConnectionAuthContext,
    lock: Omit<
      EditingLock,
      "tenantId" | "ownerUserId" | "ownerPositionId" | "ownerConnectionId" | "expiresAt"
    >,
  ): Promise<EditingLock>;
  /** Release only a lock owned by this connection; stale/other-user locks expire rather than being stolen. */
  releaseSoftLock(context: ConnectionAuthContext, lockId: EditingLock): Promise<void>;
}

/**
 * TODO(implementation): create the NATS-backed presence and soft editing-lock service.
 * Input: a scoped event bus and deployment TTL/heartbeat limits supplied by composition.
 * Output: PresenceService with per-connection cleanup and expiring presence/locks.
 * Errors: fails closed for unauthorized scope; presence outages degrade visibly without blocking records.
 * Depends on: scoped NATS subjects, connection lifecycle, and record read authorization.
 * Security: presence reveals only authorized identity/location metadata; locks are advisory, never authorization.
 */
export function createPresenceService(
  _eventBus: ScopedEventBus,
  _policy: PresencePolicy,
): PresenceService {
  throw new Error("TODO(implementation): createPresenceService");
}
