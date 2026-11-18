import type { AppScope, AuditMetadata, Unsubscribe } from "./contracts.js";

export interface PresenceIdentity {
  readonly userId: string;
  readonly positionId: string;
  readonly displayName: string;
  readonly positionLabel: string;
}

export interface PresenceLocation {
  readonly boardId?: string;
  readonly recordId?: string;
  readonly editingFieldId?: string;
  readonly cursor?: { readonly blockId: string; readonly x: number; readonly y: number };
}

export interface PresenceUpdate {
  readonly identity: PresenceIdentity;
  readonly location: PresenceLocation;
  readonly lastSeenAt: string;
}

export interface PresencePort {
  readonly publish: (
    scope: AppScope,
    location: PresenceLocation,
    audit: AuditMetadata,
  ) => Promise<void>;
  readonly subscribe: (
    scope: AppScope,
    listener: (updates: readonly PresenceUpdate[]) => void,
  ) => Unsubscribe;
  readonly clear: (scope: AppScope) => Promise<void>;
}

function presenceNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): PresencePort.${method}`);
}

/**
 * TODO(implementation): publish ephemeral viewing/editing presence and subscribe to scoped peers.
 * Input: tenant/incident, board/record location, audit metadata, and peer listeners.
 * Output: a throwing port; future subscriptions return cleanup and soft-lock presence updates.
 * Errors: all methods throw TODO(implementation); no identities or editing state are simulated.
 * Depends on: apps/realtime, session privacy policy, NATS scoped subjects, and heartbeat expiry.
 * Presence is non-blocking, never authorizes edits, and is removed on sign-out/incident switch.
 */
export function createPresenceStub(): PresencePort {
  return {
    publish: () => presenceNotImplemented("publish"),
    subscribe: () => presenceNotImplemented("subscribe"),
    clear: () => presenceNotImplemented("clear"),
  };
}
