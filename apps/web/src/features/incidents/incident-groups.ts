import type { Incident } from "@argus/schema";

const statusRank: Record<Incident["status"], number> = {
  active: 0,
  monitoring: 1,
  planned: 2,
  closed: 3,
  archived: 4,
};

export interface IncidentGroups {
  readonly live: readonly Incident[];
  readonly exercises: readonly Incident[];
}

/**
 * Separates live incidents from exercises/drills and orders each by status then activation.
 * Input: incidents already authorized for the caller.
 * Output: two lists; exercises are never mixed into the live list.
 * Errors: none.
 * Depends on: the Incident schema `kind` and `status` fields.
 */
export function groupIncidents(incidents: readonly Incident[]): IncidentGroups {
  const sorted = [...incidents].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      (b.activatedAt ?? "").localeCompare(a.activatedAt ?? "") ||
      a.name.localeCompare(b.name),
  );
  return {
    live: sorted.filter((incident) => incident.kind === "live"),
    exercises: sorted.filter((incident) => incident.kind === "exercise"),
  };
}

/** Incidents that can become the active context: anything not closed or archived. */
export function isSwitchable(incident: Incident): boolean {
  return incident.status !== "closed" && incident.status !== "archived";
}

export function statusLabel(status: Incident["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
