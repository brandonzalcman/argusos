import { createContext, useContext } from "react";
import type { AppScope } from "../../services/contracts.js";

const ActiveScopeContext = createContext<AppScope | null>(null);

/**
 * Supplies the server-established tenant/incident scope to live queries.
 * Input: an AppScope from the session provider (or the demo composition root).
 * Output: a React context provider. Errors: none.
 * Depends on: TODO(implementation) authenticated session/incident provider in app-providers.
 */
export const ActiveScopeProvider = ActiveScopeContext.Provider;

/**
 * TODO(implementation): resolve the server-established tenant and active incident for this session.
 * Input: none; reads ActiveScopeProvider (nothing supplies it outside demo mode yet).
 * Output: the AppScope used by every live query, or null while unauthenticated.
 * Errors: none; unauthenticated callers receive null and render the "unavailable" state.
 * Depends on: session/incident providers and apps/api membership checks.
 */
export function useActiveScope(): AppScope | null {
  return useContext(ActiveScopeContext);
}
