import type { WorkflowDefinition } from "@argus/schema";
import {
  Badge,
  Button,
  Input,
  PageContainer,
  PageHeader,
  Panel,
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
import { PauseCircle, Plus, Search, Workflow } from "@argus/ui/icons";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import { useFeatureSession } from "./feature-scope.js";
import { TRIGGER_TYPE_LABELS } from "./graph.js";
import { EmptyState, ErrorState, LoadingSkeleton, SessionUnavailable } from "./status-views.js";
import { useWorkflows } from "./workflow-queries.js";

/** Case-insensitive name/description/trigger filter. */
export function filterWorkflows(
  workflows: readonly WorkflowDefinition[],
  query: string,
): WorkflowDefinition[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...workflows];
  return workflows.filter((w) =>
    [w.name, w.description ?? "", TRIGGER_TYPE_LABELS[w.trigger.type]]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

/** Lifecycle presented with the locked status scale: icon, colour and a text label. */
export function LifecyclePill({
  lifecycle,
}: {
  readonly lifecycle: WorkflowDefinition["lifecycle"];
}): ReactElement {
  switch (lifecycle) {
    case "published":
      return <StatusPill status="ok" label="Published" />;
    case "draft":
      return <StatusPill status="info" label="Draft" />;
    default:
      return <StatusPill status="stale" label="Archived" />;
  }
}

/** Presentational workflow table. */
export function WorkflowTable({
  workflows,
}: {
  readonly workflows: readonly WorkflowDefinition[];
}): ReactElement {
  return (
    <TableContainer>
      <Table>
        <TableCaption className="sr-only">Workflow definitions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead align="end">Steps</TableHead>
            <TableHead>Version</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow) => (
            <TableRow key={workflow.id}>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1.5">
                  <LifecyclePill lifecycle={workflow.lifecycle} />
                  {workflow.enabled ? null : (
                    <Badge tone="neutral" variant="outline" icon={<PauseCircle />}>
                      Disabled
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <Link
                  to="/workflows/$workflowId"
                  params={{ workflowId: workflow.id }}
                  className="rounded-sm font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {workflow.name}
                </Link>
                {workflow.description ? (
                  <span className="block max-w-prose text-sm text-fg-muted">
                    {workflow.description}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{TRIGGER_TYPE_LABELS[workflow.trigger.type]}</TableCell>
              <TableCell muted>{workflow.incidentScope}</TableCell>
              <TableCell align="end" mono>
                {workflow.steps.length}
              </TableCell>
              <TableCell mono>
                v{workflow.version} · {workflow.lifecycle}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Primary action; creation is not wired to the API yet, so it is visibly unavailable. */
function NewWorkflowButton(): ReactElement {
  // TODO(implementation): open the create-workflow flow once WorkflowServicePort.createWorkflow exists.
  return (
    <Button
      variant="primary"
      leadingIcon={<Plus aria-hidden="true" />}
      disabled
      title="Creating workflows is not connected yet"
    >
      New workflow
    </Button>
  );
}

/**
 * Workflows catalog page (/workflows) backed by a typed live query.
 * Input: none (scope from the feature session). Output: searchable table with all data states.
 * Errors: query failures render an ErrorState with retry; a missing session renders no data.
 * Depends on: WorkflowServicePort.listWorkflows and the Electric live shape (TODO(implementation)).
 */
export function WorkflowsListScreen(): ReactElement {
  const session = useFeatureSession();
  const query = useWorkflows();
  const [filter, setFilter] = useState("");

  let body: ReactElement;
  let status: ReactElement | undefined;
  if (!session) {
    body = <SessionUnavailable />;
  } else if (query.isPending) {
    body = <LoadingSkeleton label="Loading workflows" />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title="Workflows failed to load"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        icon={<Workflow />}
        title="No workflows yet"
        description="Workflows automate steps when a trigger fires, such as a record change or incident escalation."
        action={<NewWorkflowButton />}
      />
    );
  } else {
    const visible = filterWorkflows(query.data, filter);
    status = (
      <span role="status" aria-live="polite" className="text-sm text-fg-muted">
        {visible.length} of {query.data.length} shown
      </span>
    );
    body = (
      <div className="grid gap-3">
        <div className="max-w-sm px-(--argus-panel-p) pt-(--argus-panel-p)">
          <Input
            type="search"
            aria-label="Filter workflows"
            placeholder="Filter by name, description or trigger"
            leadingIcon={<Search />}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState title="No matches" description="No workflow matches this filter." />
        ) : (
          <WorkflowTable workflows={visible} />
        )}
      </div>
    );
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Workflows"
        description="Versioned automation definitions and their durable runs."
        actions={<NewWorkflowButton />}
      />
      <Panel title="Workflow definitions" status={status} flush>
        {body}
      </Panel>
    </PageContainer>
  );
}
