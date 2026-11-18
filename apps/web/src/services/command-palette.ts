import type { ActorContext, AppScope, Unsubscribe } from "./contracts.js";

export interface CommandDescriptor {
  readonly id: string;
  readonly title: string;
  readonly kind: "navigation" | "record" | "incident" | "position" | "action";
  readonly targetId: string;
  readonly requiredPermission: string;
}

export interface CommandSearchRequest {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly query: string;
  readonly limit: number;
}

export interface CommandProvider {
  readonly providerId: string;
  readonly search: (request: CommandSearchRequest) => Promise<readonly CommandDescriptor[]>;
}

export interface CommandPalettePort {
  readonly registerProvider: (provider: CommandProvider) => Unsubscribe;
  readonly search: (request: CommandSearchRequest) => Promise<readonly CommandDescriptor[]>;
}

function paletteNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): CommandPalettePort.${method}`);
}

/**
 * TODO(implementation): federate keyboard command search across authorized navigation and records.
 * Input: scoped actor/query requests and command providers.
 * Output: a throwing port; future output contains only currently authorized command descriptors.
 * Errors: both methods throw TODO(implementation); future provider failures are isolated and visible.
 * Depends on: TanStack Router, API search, RBAC/ABAC, tenant terminology, and keyboard focus UI.
 * Search text, results, and telemetry must exclude unauthorized tenants, incidents, and fields.
 */
export function createCommandPaletteStub(): CommandPalettePort {
  return {
    registerProvider: () => paletteNotImplemented("registerProvider"),
    search: () => paletteNotImplemented("search"),
  };
}
