import type { AppScope, Unsubscribe } from "./contracts.js";

export type ElectricSyncState = "connecting" | "live" | "reconnecting" | "offline" | "polling";

export interface ElectricSyncSnapshot {
  readonly state: ElectricSyncState;
  readonly lastVisibleCommitAt?: string;
  readonly lastWalPosition?: string;
  readonly detail: string;
}

export interface ElectricSubscriptionRequest {
  readonly scope: AppScope;
  readonly subscriptionId: string;
  readonly tableId: string;
  readonly viewId?: string;
  readonly requiredPermissions: readonly string[];
  readonly onSnapshot: (snapshot: ElectricSyncSnapshot) => void;
  readonly onChange: (change: {
    readonly walPosition: string;
    readonly committedAt: string;
  }) => void;
}

export interface ElectricSyncPort {
  readonly subscribe: (request: ElectricSubscriptionRequest) => Promise<Unsubscribe>;
  readonly refresh: (scope: AppScope) => Promise<void>;
  readonly getSnapshot: (scope: AppScope) => ElectricSyncSnapshot;
}

function electricNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): ElectricSyncPort.${method}`);
}

/**
 * TODO(implementation): connect authorized Electric shapes and WAL-ordered live updates.
 * Input: tenant/incident-scoped table/view subscriptions and required read permissions.
 * Output: a port whose methods throw; future subscriptions return idempotent cleanup functions.
 * Errors: all methods throw TODO(implementation); future errors expose reconnect/polling state.
 * Depends on: ElectricSQL, API-issued scoped credentials, TanStack Query persistence, and RLS.
 * No client may receive rows it could not read through the API; polling fallback is five seconds.
 */
export function createElectricSyncStub(): ElectricSyncPort {
  return {
    subscribe: () => electricNotImplemented("subscribe"),
    refresh: () => electricNotImplemented("refresh"),
    getSnapshot: () => electricNotImplemented("getSnapshot"),
  };
}
