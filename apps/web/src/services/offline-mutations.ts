import type { AppScope, AuditMetadata } from "./contracts.js";

export interface OfflineMutation {
  readonly mutationId: string;
  readonly audit: AuditMetadata;
  readonly tableId: string;
  readonly recordId: string;
  readonly baseVersion: number;
  readonly patch: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly queuedAt: string;
}

export interface MutationConflict {
  readonly conflictId: string;
  readonly mutationId: string;
  readonly fieldId: string;
  readonly localValue: unknown;
  readonly serverValue: unknown;
  readonly serverVersion: number;
}

export interface ConflictResolution {
  readonly conflictId: string;
  readonly strategy: "keep-local" | "keep-server" | "merge-fields";
  readonly mergedPatch?: Readonly<Record<string, unknown>>;
  readonly expectedServerVersion: number;
  readonly audit: AuditMetadata;
}

export interface OfflineMutationQueuePort {
  readonly enqueue: (mutation: OfflineMutation) => Promise<void>;
  readonly list: (scope: AppScope) => Promise<readonly OfflineMutation[]>;
  readonly listConflicts: (scope: AppScope) => Promise<readonly MutationConflict[]>;
  readonly resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  readonly replay: (scope: AppScope) => Promise<void>;
}

function queueNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): OfflineMutationQueuePort.${method}`);
}

/**
 * TODO(implementation): persist encrypted offline writes and replay them idempotently on reconnect.
 * Input: scoped optimistic mutations with base versions and explicit conflict resolutions.
 * Output: a throwing queue port; future methods expose durable queue and same-field conflicts.
 * Errors: every method throws TODO(implementation); no queued write or conflict is fabricated.
 * Depends on: IndexedDB encryption/lifecycle, API optimistic locking, Electric sync, and audit IDs.
 * Queue storage is tenant/session isolated, cleared on sign-out, and redacts hidden field values.
 */
export function createOfflineMutationQueueStub(): OfflineMutationQueuePort {
  return {
    enqueue: () => queueNotImplemented("enqueue"),
    list: () => queueNotImplemented("list"),
    listConflicts: () => queueNotImplemented("listConflicts"),
    resolveConflict: () => queueNotImplemented("resolveConflict"),
    replay: () => queueNotImplemented("replay"),
  };
}
