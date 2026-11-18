import type { SessionSnapshot } from "@argus/schema";
import type { StatusLevel } from "@argus/ui";
import { useQuery } from "@tanstack/react-query";
import { useSessionPort } from "../../services/studio.js";

export const sessionQueryKey = ["session"] as const;

export interface SessionState {
  /** null = signed out / no session service connected. undefined while loading. */
  readonly snapshot: SessionSnapshot | null | undefined;
  readonly loading: boolean;
  readonly error: Error | null;
}

/** Current session snapshot from the SessionPort (stub resolves null = signed out). */
export function useSessionSnapshot(): SessionState {
  const port = useSessionPort();
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => port.get(),
    staleTime: 60_000,
    retry: false,
  });
  return {
    snapshot: query.data,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}

/** Maps an incident level (0–10) to the locked status scale used by the top bar pill. */
export function incidentLevelStatus(level: number): StatusLevel {
  if (level >= 4) return "critical";
  if (level === 3) return "high";
  if (level === 2) return "medium";
  if (level === 1) return "low";
  return "info";
}
