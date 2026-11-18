import { createContext, useContext } from "react";
import type { ActorContext, AppScope } from "../../services/contracts.js";

/** Tenant, incident, and actor identity every feature query and mutation must carry. */
export interface FeatureSession {
  readonly scope: AppScope;
  readonly actor: ActorContext;
}

const FeatureSessionContext = createContext<FeatureSession | null>(null);

/**
 * Supplies the authenticated tenant/incident/actor context to workflow and admin features.
 * Input: a FeatureSession from the (future) session provider, or a test composition root.
 * Output: a React context provider.
 * Errors: none.
 * Depends on: TODO(implementation) session/incident provider in app-providers; nothing supplies it yet.
 */
export const FeatureSessionProvider = FeatureSessionContext.Provider;

/**
 * Reads the current session scope; null means no authenticated session is available.
 * Input: none. Output: the FeatureSession or null. Errors: none.
 * Depends on: FeatureSessionProvider.
 */
export function useFeatureSession(): FeatureSession | null {
  return useContext(FeatureSessionContext);
}
