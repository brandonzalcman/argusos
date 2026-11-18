import type { LayoutDefinition, MenuDefinition, Position, ThemeDefinition } from "@argus/schema";
import { createContext, useContext } from "react";
import type { ActorContext, AppScope } from "../../services/contracts.js";

export type { UserPreferences } from "../workflows/local-types.js";
import type { UserPreferences } from "../workflows/local-types.js";

export interface SaveDraftRequest<T> {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly expectedVersion: number;
  readonly definition: T;
}

/** Thrown by save methods when expectedVersion is stale; carries the winning server value. */
export class DefinitionConflictError<T> extends Error {
  readonly serverDefinition: T;
  constructor(serverDefinition: T) {
    super("The definition was changed by someone else.");
    this.name = "DefinitionConflictError";
    this.serverDefinition = serverDefinition;
  }
}

/** Typed boundary to the customization (theme, menu, homepage) and preference APIs. */
export interface AdminServicePort {
  readonly listPositions: (scope: AppScope) => Promise<readonly Position[]>;
  readonly getTheme: (scope: AppScope) => Promise<ThemeDefinition | null>;
  readonly saveTheme: (request: SaveDraftRequest<ThemeDefinition>) => Promise<ThemeDefinition>;
  readonly getMenu: (scope: AppScope) => Promise<MenuDefinition | null>;
  readonly saveMenu: (request: SaveDraftRequest<MenuDefinition>) => Promise<MenuDefinition>;
  readonly listHomepages: (scope: AppScope) => Promise<readonly LayoutDefinition[]>;
  readonly saveHomepage: (request: SaveDraftRequest<LayoutDefinition>) => Promise<LayoutDefinition>;
  readonly getPreferences: (scope: AppScope, actor: ActorContext) => Promise<UserPreferences>;
  readonly savePreferences: (
    request: SaveDraftRequest<UserPreferences>,
  ) => Promise<UserPreferences>;
  /** Clears locally cached offline data after the user confirms; queued writes are reported first. */
  readonly clearOfflineData: (scope: AppScope, actor: ActorContext) => Promise<void>;
}

function notImplemented(method: string): Promise<never> {
  return Promise.reject(new Error(`TODO(implementation): AdminServicePort.${method}`));
}

/**
 * TODO(implementation): connect to apps/api customization and preference endpoints.
 * Input: scoped, actor-attributed requests. Output: a port whose methods reject until implemented.
 * Errors: every method rejects with TODO(implementation); future saves reject with
 * DefinitionConflictError on a stale expectedVersion and write an audit event.
 * Depends on: apps/api theme/menu/layout/preferences routes, RLS, audit log, offline queue port.
 */
export function createAdminServiceStub(): AdminServicePort {
  return {
    listPositions: () => notImplemented("listPositions"),
    getTheme: () => notImplemented("getTheme"),
    saveTheme: () => notImplemented("saveTheme"),
    getMenu: () => notImplemented("getMenu"),
    saveMenu: () => notImplemented("saveMenu"),
    listHomepages: () => notImplemented("listHomepages"),
    saveHomepage: () => notImplemented("saveHomepage"),
    getPreferences: () => notImplemented("getPreferences"),
    savePreferences: () => notImplemented("savePreferences"),
    clearOfflineData: () => notImplemented("clearOfflineData"),
  };
}

const AdminServiceContext = createContext<AdminServicePort>(createAdminServiceStub());

/** Provider to inject a real or test admin service. */
export const AdminServiceProvider = AdminServiceContext.Provider;

/** Returns the injected admin service (the throwing stub by default). */
export function useAdminService(): AdminServicePort {
  return useContext(AdminServiceContext);
}
