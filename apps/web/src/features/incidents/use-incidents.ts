import type { Incident } from "@argus/schema";
import { useFeatureSources } from "../live-data/feature-sources.js";
import { type ScopedLiveQuery, useScopedLiveQuery } from "../live-data/use-scoped-live-query.js";
import type { IncidentsSource } from "./incidents-source.js";

const requiredPermissions = ["incident:read"] as const;

/**
 * Live query of the incidents the caller may see.
 * Input: optional source override (tests/Storybook); defaults to the injected FeatureSources.
 * Output: loading/unavailable/error/empty/ready state and Electric liveness.
 * Errors: surfaced as the error state.
 * Depends on: useScopedLiveQuery and the `incidents` table shape.
 */
export function useIncidents(sourceOverride?: IncidentsSource): ScopedLiveQuery<Incident> {
  const injected = useFeatureSources().incidents;
  const source = sourceOverride ?? injected;
  return useScopedLiveQuery<Incident>({
    queryKey: ["incidents"],
    tableId: "incidents",
    requiredPermissions,
    load: source.list,
  });
}
