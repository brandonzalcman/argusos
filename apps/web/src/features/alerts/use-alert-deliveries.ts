import { useFeatureSources } from "../live-data/feature-sources.js";
import { type ScopedLiveQuery, useScopedLiveQuery } from "../live-data/use-scoped-live-query.js";
import type { AlertDeliveryRow, AlertsSource } from "./alerts-source.js";

const requiredPermissions = ["alert:read"] as const;

/**
 * Live query of alert delivery rows, scoped to the active tenant and incident.
 * Input: optional source override (tests/Storybook).
 * Output: loading/unavailable/error/empty/ready state and Electric liveness.
 * Errors: surfaced as the error state.
 * Depends on: useScopedLiveQuery and the `alert_deliveries` shape.
 */
export function useAlertDeliveries(
  sourceOverride?: AlertsSource,
): ScopedLiveQuery<AlertDeliveryRow> {
  const injected = useFeatureSources().alerts;
  const source = sourceOverride ?? injected;
  return useScopedLiveQuery<AlertDeliveryRow>({
    queryKey: ["alert-deliveries"],
    tableId: "alert_deliveries",
    requiredPermissions,
    load: source.listDeliveries,
  });
}

/** Alerts that still need a human acknowledgement (one entry per alert, not per channel). */
export function pendingAcknowledgements(
  rows: readonly AlertDeliveryRow[],
): readonly AlertDeliveryRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.alert.acknowledgedAt !== null || seen.has(row.alert.id)) return false;
    if (row.alert.status === "cancelled" || row.alert.status === "failed") return false;
    seen.add(row.alert.id);
    return true;
  });
}
