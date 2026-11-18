import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAppServices } from "../../app/services-provider.js";
import type { AppScope } from "../../services/contracts.js";
import { useActiveScope } from "./active-scope.js";
import { deriveLiveQueryState, type LiveQueryState } from "./live-query-state.js";

export interface ScopedLiveQueryOptions<T> {
  /** Stable key; the scope's tenant and incident are appended so caches never cross scopes. */
  readonly queryKey: readonly string[];
  /** Physical or system table whose Electric shape keeps this query current. */
  readonly tableId: string;
  readonly requiredPermissions: readonly string[];
  readonly load: (scope: AppScope) => Promise<readonly T[]>;
}

export interface ScopedLiveQuery<T> {
  readonly state: LiveQueryState<readonly T[]>;
  /** True only while an Electric subscription is established; otherwise data may be stale. */
  readonly isLive: boolean;
}

/**
 * Loads a scoped list and keeps it fresh from the Electric sync port.
 * Input: key, table, required permissions and a scoped loader supplied by the feature.
 * Output: a LiveQueryState plus a liveness flag; with no scope nothing is requested.
 * Errors: loader or subscription failures surface as the error state / isLive=false, never fake rows.
 * Depends on: useActiveScope, ElectricSyncPort (currently a throwing stub) and TanStack Query.
 */
export function useScopedLiveQuery<T>(options: ScopedLiveQueryOptions<T>): ScopedLiveQuery<T> {
  const scope = useActiveScope();
  const { electricSync } = useAppServices();
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);
  const { tableId, requiredPermissions, load } = options;
  const queryKey = [...options.queryKey, scope?.tenantId ?? "none", scope?.incidentId ?? "none"];
  const query = useQuery({
    queryKey,
    enabled: scope !== null,
    retry: false,
    queryFn: () => load(scope as AppScope),
  });

  useEffect(() => {
    if (scope === null) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    try {
      void electricSync
        .subscribe({
          scope,
          subscriptionId: `${tableId}:${scope.tenantId}:${scope.incidentId ?? "global"}`,
          tableId,
          requiredPermissions,
          onSnapshot: (snapshot) => setIsLive(snapshot.state === "live"),
          onChange: () => void queryClient.invalidateQueries({ queryKey }),
        })
        .then((unsubscribe) => {
          if (cancelled) unsubscribe();
          else cleanup = unsubscribe;
        })
        .catch(() => setIsLive(false));
    } catch {
      // The scaffold port throws TODO(implementation); the UI reports "not live" instead.
      setIsLive(false);
    }
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [scope, electricSync, queryClient, tableId, requiredPermissions]);

  return {
    isLive,
    state: deriveLiveQueryState({
      hasScope: scope !== null,
      isPending: query.isPending,
      error: query.error,
      data: query.data,
      retry: () => void query.refetch(),
    }),
  };
}
