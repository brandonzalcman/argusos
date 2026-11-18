export { createAuthorizationPreviewStub } from "./authorization-preview.js";
export { createCommandPaletteStub } from "./command-palette.js";
export type { ActorContext, AppScope, AuditMetadata, Unsubscribe } from "./contracts.js";
export { createElectricSyncStub } from "./electric-sync.js";
export { createPerformanceInstrumentationStub } from "./instrumentation.js";
export { createOfflineMutationQueueStub } from "./offline-mutations.js";
export { createPresenceStub } from "./presence.js";
export { createRealtimeConnectionStub } from "./realtime.js";

import type { AuthorizationPreviewPort } from "./authorization-preview.js";
import { createAuthorizationPreviewStub } from "./authorization-preview.js";
import type { CommandPalettePort } from "./command-palette.js";
import { createCommandPaletteStub } from "./command-palette.js";
import type { ElectricSyncPort } from "./electric-sync.js";
import { createElectricSyncStub } from "./electric-sync.js";
import type { PerformanceInstrumentationPort } from "./instrumentation.js";
import { createPerformanceInstrumentationStub } from "./instrumentation.js";
import type { OfflineMutationQueuePort } from "./offline-mutations.js";
import { createOfflineMutationQueueStub } from "./offline-mutations.js";
import type { PresencePort } from "./presence.js";
import { createPresenceStub } from "./presence.js";
import type { RealtimeConnectionPort } from "./realtime.js";
import { createRealtimeConnectionStub } from "./realtime.js";

/** Composition-root contract. Components depend on ports rather than concrete infrastructure. */
export interface AppServices {
  readonly electricSync: ElectricSyncPort;
  readonly offlineMutations: OfflineMutationQueuePort;
  readonly realtime: RealtimeConnectionPort;
  readonly presence: PresencePort;
  readonly commandPalette: CommandPalettePort;
  readonly authorizationPreview: AuthorizationPreviewPort;
  readonly instrumentation: PerformanceInstrumentationPort;
}

/**
 * Creates the explicitly disconnected service set used by the scaffold composition root.
 * Input: none; no URLs, credentials, sessions, or operational data are constructed.
 * Output: one instance of each throwing service port.
 * Errors: invoking any underlying method throws its documented TODO(implementation).
 * Depends on: future authenticated adapters supplied to AppProviders for real deployments.
 */
export function createScaffoldServices(): AppServices {
  return {
    electricSync: createElectricSyncStub(),
    offlineMutations: createOfflineMutationQueueStub(),
    realtime: createRealtimeConnectionStub(),
    presence: createPresenceStub(),
    commandPalette: createCommandPaletteStub(),
    authorizationPreview: createAuthorizationPreviewStub(),
    instrumentation: createPerformanceInstrumentationStub(),
  };
}
