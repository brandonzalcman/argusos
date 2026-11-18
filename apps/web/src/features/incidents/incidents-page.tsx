import type { Incident } from "@argus/schema";
import {
  Button,
  Field,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  StatusPill,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@argus/ui";
import { type FormEvent, type ReactElement, useState } from "react";
import { useActiveScope } from "../live-data/active-scope.js";
import { useFeatureSources } from "../live-data/feature-sources.js";
import { LiveStatus } from "../live-data/live-status.js";
import { QueryBoundary } from "../live-data/query-boundary.js";
import { formatTimestamp } from "../live-data/time.js";
import { groupIncidents, isSwitchable, statusLabel } from "./incident-groups.js";
import type { IncidentsSource } from "./incidents-source.js";
import { useIncidents } from "./use-incidents.js";

export interface IncidentsPageProps {
  readonly source?: IncidentsSource;
}

/**
 * Incidents list and incident switcher.
 * Input: optional data source override; defaults to the injected FeatureSources incidents port.
 * Output: separated live and exercise tables plus a switcher; no data is shown until loaded.
 * Errors: load and switch failures are announced inline with retry.
 * Depends on: useIncidents, IncidentsSource, and server-side authorization of every row.
 */
export function IncidentsPage({ source: sourceOverride }: IncidentsPageProps): ReactElement {
  const injected = useFeatureSources().incidents;
  const source = sourceOverride ?? injected;
  const { state, isLive } = useIncidents(source);
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Incidents"
        description="Live incidents and exercises are listed separately."
        meta={<LiveStatus isLive={isLive} />}
      />
      <QueryBoundary
        state={state}
        label="incidents"
        empty={{
          title: "No incidents",
          description:
            "No incidents are visible to your position. Activation controls arrive with the incidents API.",
        }}
      >
        {(incidents) => {
          const groups = groupIncidents(incidents);
          return (
            <>
              <IncidentSwitcher incidents={incidents} source={source} />
              <IncidentTable title="Live incidents" incidents={groups.live} />
              <IncidentTable title="Exercises and drills" incidents={groups.exercises} />
            </>
          );
        }}
      </QueryBoundary>
    </PageContainer>
  );
}

/** Select an incident and confirm; exercises are labelled so they cannot be mistaken for live. */
export function IncidentSwitcher({
  incidents,
  source,
}: {
  readonly incidents: readonly Incident[];
  readonly source: IncidentsSource;
}): ReactElement {
  const scope = useActiveScope();
  const groups = groupIncidents(incidents);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const chosen = incidents.find((incident) => incident.id === selected);

  const toOption = (incident: Incident) => ({
    value: incident.id,
    label: `${incident.name} (${statusLabel(incident.status)})`,
  });
  const options = [
    { label: "Live incidents", options: groups.live.filter(isSwitchable).map(toOption) },
    {
      label: "Exercises and drills (not live)",
      options: groups.exercises.filter(isSwitchable).map(toOption),
    },
  ].filter((group) => group.options.length > 0);

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (chosen === undefined) return;
    if (scope === null) {
      setMessage({ kind: "error", text: "No authenticated scope is available." });
      return;
    }
    setPending(true);
    setMessage(null);
    source
      .switchActive(scope, chosen.id)
      .then(() => setMessage({ kind: "ok", text: `Active incident is now ${chosen.name}.` }))
      .catch((error: unknown) =>
        setMessage({
          kind: "error",
          text: error instanceof Error ? error.message : "Could not switch incident.",
        }),
      )
      .finally(() => setPending(false));
  }

  return (
    <Panel title="Switch active incident">
      <form className="grid max-w-xl gap-4" onSubmit={submit} aria-label="Incident switcher">
        <Field label="Incident">
          <Select
            options={options}
            value={selected}
            onValueChange={setSelected}
            placeholder="Choose an incident"
          />
        </Field>
        {chosen?.kind === "exercise" ? (
          <p role="note" className="text-sm text-warning">
            This is an exercise. Records created here stay separate from live incidents.
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" loading={pending} disabled={chosen === undefined}>
            Switch incident
          </Button>
        </div>
        {message === null ? null : (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-critical" : "text-success"}
          >
            {message.text}
          </p>
        )}
      </form>
    </Panel>
  );
}

function IncidentTable({
  title,
  incidents,
}: {
  readonly title: string;
  readonly incidents: readonly Incident[];
}): ReactElement {
  const now = new Date();
  return (
    <Panel title={`${title} (${incidents.length})`} flush={incidents.length > 0}>
      {incidents.length === 0 ? (
        <p className="text-fg-muted">None.</p>
      ) : (
        <TableContainer>
          <Table>
            <TableCaption className="sr-only">{title}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Operational period</TableHead>
                <TableHead>Activated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <StatusPill
                      status={incident.status === "active" ? "high" : "stale"}
                      label={statusLabel(incident.status)}
                    />
                  </TableCell>
                  <TableCell>{incident.name}</TableCell>
                  <TableCell mono>{incident.level ?? "—"}</TableCell>
                  <TableCell>{incident.operationalPeriod ?? "—"}</TableCell>
                  <TableCell mono>
                    {incident.activatedAt === null
                      ? "Not activated"
                      : formatTimestamp(incident.activatedAt, now)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  );
}
