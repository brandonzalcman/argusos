import type { ConnectionAuthContext } from "../auth/context.js";
import type { EventEnvelope } from "../events/bus.js";

export const POLLING_FALLBACK_INTERVAL_MS = 5000 as const;

export interface BackfillPage {
  readonly events: readonly EventEnvelope[];
  readonly nextCursor: string | null;
  readonly complete: boolean;
}

export interface BackfillPort {
  /**
   * Read one bounded durable page after a cursor using current, not historical, authorization.
   * Input: revalidated connection scope, canonical stream, cursor, and page limit.
   * Output: ordered events safe to filter for this subscriber and the next opaque cursor.
   * Errors: throws cursor-expired, forbidden, or transient infrastructure errors.
   * Depends on: JetStream/WAL cursor storage, current RLS/FLS policy, and canonical scoped subjects.
   */
  read(
    context: ConnectionAuthContext,
    stream: string,
    afterCursor: string | null,
    limit: number,
  ): Promise<BackfillPage>;
}

export interface ReconnectPolicy {
  readonly maximumAttempts: number;
  readonly baseDelayMs: number;
  readonly maximumDelayMs: number;
  readonly jitterRatio: number;
}

export interface RecoveryCoordinator {
  /** Replay all pages in commit/cursor order, de-duplicate live overlap, and reauthorize every page. */
  backfill(
    context: ConnectionAuthContext,
    stream: string,
    afterCursor: string | null,
    emit: (event: EventEnvelope) => Promise<void>,
  ): Promise<string | null>;
  /** Return a bounded jittered reconnect delay or null after the configured attempt limit. */
  reconnectDelay(attempt: number, policy: ReconnectPolicy): number | null;
  /** Describe explicit five-second polling fallback; clients must show stale/offline status while active. */
  pollingFallback(): {
    readonly intervalMs: typeof POLLING_FALLBACK_INTERVAL_MS;
    readonly showStaleBanner: true;
  };
}

/**
 * TODO(implementation): create reconnect, durable backfill, and polling-fallback coordination.
 * Input: an authorized BackfillPort and monotonic clock supplied by composition.
 * Output: a RecoveryCoordinator with bounded retries, deterministic cursors, and no missed changes.
 * Errors: expired cursors require an explicitly authorized full resync; transient failures retain backoff.
 * Depends on: JetStream replay, ElectricSQL/API polling contracts, reauthentication, and telemetry.
 * Security: replay uses current RLS/FLS and never sends records revoked while the client was offline.
 */
export function createRecoveryCoordinator(_backfill: BackfillPort): RecoveryCoordinator {
  throw new Error("TODO(implementation): createRecoveryCoordinator");
}
