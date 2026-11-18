import type { Incident } from "@argus/schema";
import type { AppScope } from "../../services/contracts.js";

/** Data port for incidents; the real adapter is an authorized Electric shape plus API mutations. */
export interface IncidentsSource {
  readonly list: (scope: AppScope) => Promise<readonly Incident[]>;
  readonly switchActive: (scope: AppScope, incidentId: string) => Promise<void>;
}

/**
 * TODO(implementation): list tenant-scoped incidents and switch the active incident.
 * Input: AppScope; for switching, the target incident id chosen in the switcher.
 * Output: incidents visible to the caller's position; switching resolves when audited server-side.
 * Errors: rejects when unauthorized, cross-tenant or the incident is archived.
 * Depends on: apps/api incidents routes, the `incidents` Electric shape and audit logging.
 */
export const incidentsSourceStub: IncidentsSource = {
  list: () => Promise.reject(new Error("TODO(implementation): IncidentsSource.list")),
  switchActive: () =>
    Promise.reject(new Error("TODO(implementation): IncidentsSource.switchActive")),
};
