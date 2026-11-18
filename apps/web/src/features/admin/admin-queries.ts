import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FeatureSession, useFeatureSession } from "../workflows/feature-scope.js";
import { type AdminServicePort, useAdminService } from "./admin-service.js";

function key(session: FeatureSession | null, name: string): readonly unknown[] {
  return ["admin", session?.scope.tenantId ?? null, session?.scope.incidentId ?? null, name];
}

function useScopedQuery<T>(
  name: string,
  load: (service: AdminServicePort, session: FeatureSession) => Promise<T>,
) {
  const session = useFeatureSession();
  const service = useAdminService();
  return useQuery({
    queryKey: key(session, name),
    enabled: session !== null,
    queryFn: () => load(service, session as FeatureSession),
  });
}

export const usePositions = () => useScopedQuery("positions", (s, x) => s.listPositions(x.scope));
export const useTheme = () => useScopedQuery("theme", (s, x) => s.getTheme(x.scope));
export const useMenu = () => useScopedQuery("menu", (s, x) => s.getMenu(x.scope));
export const useHomepages = () => useScopedQuery("homepages", (s, x) => s.listHomepages(x.scope));
export const usePreferences = () =>
  useScopedQuery("preferences", (s, x) => s.getPreferences(x.scope, x.actor));

/**
 * Builds a save mutation that attaches the session and invalidates the admin cache on success.
 * Callers pass the optimistic expectedVersion; DefinitionConflictError rejections are surfaced as-is.
 */
export function useAdminSave<T, R>(
  name: string,
  save: (
    service: AdminServicePort,
    request: { session: FeatureSession; expectedVersion: number; definition: T },
  ) => Promise<R>,
) {
  const session = useFeatureSession();
  const service = useAdminService();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly expectedVersion: number; readonly definition: T }) => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return save(service, { session, ...input });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(session, name) }),
  });
}

/** Clears offline data; the caller must have obtained explicit confirmation. */
export function useClearOfflineData() {
  const session = useFeatureSession();
  const service = useAdminService();
  return useMutation({
    mutationFn: () => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return service.clearOfflineData(session.scope, session.actor);
    },
  });
}
