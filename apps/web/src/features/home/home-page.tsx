import { Button, PageContainer, PageHeader, Panel } from "@argus/ui";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { pendingAcknowledgements, useAlertDeliveries } from "../alerts/use-alert-deliveries.js";
import { groupIncidents } from "../incidents/incident-groups.js";
import { useIncidents } from "../incidents/use-incidents.js";
import { LiveStatus } from "../live-data/live-status.js";
import { QueryBoundary } from "../live-data/query-boundary.js";
import { formatTimestamp } from "../live-data/time.js";

const quickActions = [
  { to: "/alerts", label: "Compose an alert" },
  { to: "/incidents", label: "Switch incident" },
  { to: "/maps", label: "Open the map" },
  { to: "/boards", label: "Browse boards" },
] as const;

/**
 * Operations home: active incident, key figures, quick actions and live status.
 * Input: none; data comes from live incident and alert queries.
 * Output: panels that show real values only after loading, otherwise honest state messages.
 * Errors: each panel reports its own load failure with retry.
 * Depends on: useIncidents, useAlertDeliveries.
 * TODO(implementation): render the position homepage board definition once boards exist.
 */
export function OperationsHome(): ReactElement {
  const incidents = useIncidents();
  const alerts = useAlertDeliveries();
  const now = new Date();
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Operations home"
        description="Shared operating picture for the active incident."
        meta={<LiveStatus isLive={incidents.isLive && alerts.isLive} />}
      />
      <div className="grid gap-(--argus-gap) lg:grid-cols-2">
        <Panel title="Active incident">
          <QueryBoundary
            state={incidents.state}
            label="incidents"
            empty={{
              title: "No incidents",
              description: "No incidents are visible to your position.",
            }}
          >
            {(rows) => {
              const active = groupIncidents(rows).live.find(
                (incident) => incident.status === "active",
              );
              return active === undefined ? (
                <p className="text-fg-muted">No live incident is active.</p>
              ) : (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
                  <dt className="text-fg-muted">Name</dt>
                  <dd>{active.name}</dd>
                  <dt className="text-fg-muted">Level</dt>
                  <dd className="font-mono">{active.level ?? "—"}</dd>
                  <dt className="text-fg-muted">Operational period</dt>
                  <dd>{active.operationalPeriod ?? "—"}</dd>
                  <dt className="text-fg-muted">Activated</dt>
                  <dd className="font-mono">
                    {active.activatedAt === null
                      ? "Not activated"
                      : formatTimestamp(active.activatedAt, now)}
                  </dd>
                </dl>
              );
            }}
          </QueryBoundary>
        </Panel>
        <Panel title="Key figures">
          <QueryBoundary
            state={alerts.state}
            label="alerts"
            empty={{
              title: "No alerts",
              description: "No alerts have been sent in this incident.",
            }}
          >
            {(rows) => (
              <p>
                <strong className="text-2xl font-semibold tabular-nums">
                  {pendingAcknowledgements(rows).length}
                </strong>{" "}
                <span className="text-fg-muted">alerts awaiting acknowledgement</span>
              </p>
            )}
          </QueryBoundary>
        </Panel>
      </div>
      <Panel title="Quick actions">
        <ul className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <li key={action.to}>
              <Button asChild variant="secondary">
                <Link to={action.to}>{action.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </PageContainer>
  );
}
