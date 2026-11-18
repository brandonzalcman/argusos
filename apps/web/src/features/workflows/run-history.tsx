import type { WorkflowRun } from "@argus/schema";
import {
  Button,
  ConnectionIndicator,
  StatusPill,
  type StatusPillProps,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@argus/ui";
import { ChevronDown, ChevronRight, History } from "@argus/ui/icons";
import { type ReactElement, useState } from "react";
import { useFeatureSession } from "./feature-scope.js";
import { formatDuration, formatTimestamp } from "./format.js";
import { EmptyState, ErrorState, LoadingSkeleton, SessionUnavailable } from "./status-views.js";
import { useWorkflowRuns } from "./workflow-queries.js";

const RUN_STATUS: Readonly<
  Record<WorkflowRun["status"], { status: StatusPillProps["status"]; label: string }>
> = {
  queued: { status: "stale", label: "Queued" },
  running: { status: "info", label: "Running" },
  waiting: { status: "medium", label: "Waiting" },
  retrying: { status: "high", label: "Retrying" },
  succeeded: { status: "ok", label: "Succeeded" },
  failed: { status: "critical", label: "Failed" },
  cancelled: { status: "stale", label: "Cancelled" },
};

export interface RunTableProps {
  readonly runs: readonly WorkflowRun[];
  readonly now?: Date;
}

/** Presentational run list; context payloads shown here are already redacted server-side. */
export function RunTable({ runs, now }: RunTableProps): ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = runs.find((run) => run.id === openId) ?? null;
  return (
    <div className="grid gap-3">
      <TableContainer maxHeight="22rem">
        <Table>
          <TableCaption className="sr-only">Workflow runs, newest first</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const view = RUN_STATUS[run.status];
              const expanded = openId === run.id;
              return (
                <TableRow key={run.id} selected={expanded}>
                  <TableCell>
                    <StatusPill status={view.status} label={view.label} size="sm" />
                  </TableCell>
                  <TableCell mono>{formatTimestamp(run.startedAt, now)}</TableCell>
                  <TableCell mono>v{run.workflowVersion}</TableCell>
                  <TableCell mono>
                    {formatDuration(run.startedAt, run.completedAt) ?? "in progress"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={expanded}
                      leadingIcon={
                        expanded ? (
                          <ChevronDown aria-hidden="true" />
                        ) : (
                          <ChevronRight aria-hidden="true" />
                        )
                      }
                      onClick={() => setOpenId(expanded ? null : run.id)}
                    >
                      {expanded ? "Hide" : "Show"} context
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {open ? (
        <section aria-label={`Context of run ${open.id}`}>
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-xs text-fg">
            {JSON.stringify(open.context, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

/** Live run history for a workflow: loading, empty, error and polling-fallback states. */
export function RunHistoryPanel({ workflowId }: { readonly workflowId: string }): ReactElement {
  const session = useFeatureSession();
  const query = useWorkflowRuns(workflowId);
  let body: ReactElement;
  if (!session) body = <SessionUnavailable />;
  else if (query.isPending) body = <LoadingSkeleton label="Loading run history" />;
  else if (query.isError)
    body = (
      <ErrorState
        title="Run history failed to load"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  else if (query.data.length === 0)
    body = (
      <EmptyState
        icon={<History />}
        title="No runs yet"
        description="Runs appear here when the trigger fires or after a published test."
      />
    );
  else body = <RunTable runs={query.data} />;
  return (
    <div className="grid gap-3">
      <ConnectionIndicator
        variant="pill"
        state={query.isError ? "offline" : "polling"}
        stateDetail={
          query.isError ? "Not live — last refresh failed." : "Refreshes every 5 seconds (polling)."
        }
      />
      {body}
    </div>
  );
}
