import type { WorkflowEdge, WorkflowStep, WorkflowTrigger } from "@argus/schema";
import { Badge, cn, focusRing, Panel } from "@argus/ui";
import { ChevronRight, CircleCheck, TriangleAlert, Zap } from "@argus/ui/icons";
import { Fragment, type KeyboardEvent, type ReactElement, useRef } from "react";
import { type GraphIssue, layoutSteps, STEP_TYPE_LABELS, TRIGGER_TYPE_LABELS } from "./graph.js";

/** Selection id used for the (non-deletable) trigger node. */
export const TRIGGER_NODE_ID = "__trigger__";

export interface GraphEditorProps {
  readonly trigger: WorkflowTrigger;
  readonly steps: readonly WorkflowStep[];
  readonly edges: readonly WorkflowEdge[];
  readonly issues: readonly GraphIssue[];
  readonly selectedId: string;
  readonly readOnly?: boolean;
  readonly onSelect: (id: string) => void;
  /** Enter / F2 on a node: move focus to its configuration form. */
  readonly onEdit: (id: string) => void;
  /** Delete on a step node; the host confirms with the step name. */
  readonly onRequestDelete: (stepId: string) => void;
}

function outgoing(
  stepId: string,
  edges: readonly WorkflowEdge[],
  names: ReadonlyMap<string, string>,
) {
  return edges
    .filter((edge) => edge.sourceStepId === stepId)
    .map((edge) => `${edge.branch} → ${names.get(edge.targetStepId) ?? "missing step"}`);
}

/**
 * Keyboard-operable trigger → condition/action step graph.
 * Steps are columns by distance from the trigger; each node lists its outgoing branches as text so
 * the graph is understandable without sight of a canvas.
 * Keys: Arrow keys/Home/End move between nodes, Enter or F2 edits, Delete removes a step.
 * Input: draft trigger/steps/edges. Output: selection, edit and delete callbacks (host owns state).
 * TODO(implementation): replace the column layout with the React Flow canvas for drag-to-connect
 * while keeping this keyboard model as the accessible alternative.
 */
export function GraphEditor({
  trigger,
  steps,
  edges,
  issues,
  selectedId,
  readOnly = false,
  onSelect,
  onEdit,
  onRequestDelete,
}: GraphEditorProps): ReactElement {
  const laidOut = layoutSteps(steps, edges);
  const names = new Map(steps.map((s) => [s.id, s.name]));
  const order = [TRIGGER_NODE_ID, ...laidOut.map((l) => l.step.id)];
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const columns = new Map<number, typeof laidOut>();
  for (const item of laidOut) {
    columns.set(item.depth, [...(columns.get(item.depth) ?? []), item]);
  }
  const issueIds = new Set(issues.map((i) => i.stepId).filter(Boolean));

  const focusNode = (id: string | undefined): void => {
    if (!id) return;
    onSelect(id);
    refs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = order.indexOf(selectedId);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusNode(order[Math.min(order.length - 1, index + 1)]);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusNode(order[Math.max(0, index - 1)]);
        break;
      case "Home":
        event.preventDefault();
        focusNode(order[0]);
        break;
      case "End":
        event.preventDefault();
        focusNode(order[order.length - 1]);
        break;
      case "Enter":
      case "F2":
        event.preventDefault();
        onEdit(selectedId);
        break;
      case "Delete":
        if (!readOnly && selectedId !== TRIGGER_NODE_ID) {
          event.preventDefault();
          onRequestDelete(selectedId);
        }
        break;
      default:
    }
  };

  const nodeClasses = (selected: boolean, hasIssue: boolean): string =>
    cn(
      "flex w-full flex-col gap-1 rounded-md border bg-surface px-3 py-2.5 text-start text-fg shadow-sm",
      "transition-[border-color,box-shadow] duration-(--argus-duration-fast) ease-out",
      "hover:border-fg-muted",
      focusRing,
      hasIssue ? "border-critical" : selected ? "border-accent" : "border-border",
      selected && "bg-accent-subtle ring-2 ring-accent/40",
    );

  return (
    <Panel
      title="Step graph"
      description="Arrow keys move between nodes, Enter or F2 edits, Delete removes a step."
      status={
        issues.length > 0 ? (
          <Badge tone="critical" icon={<TriangleAlert />}>
            {issues.length} {issues.length === 1 ? "problem" : "problems"}
          </Badge>
        ) : (
          <Badge tone="success" icon={<CircleCheck />}>
            Graph valid
          </Badge>
        )
      }
      bodyClassName="grid gap-3"
    >
      <p id="graph-help" className="sr-only">
        Use arrow keys to move between nodes, Enter or F2 to edit, Delete to remove a step.
      </p>
      <div
        role="listbox"
        aria-label="Workflow nodes"
        aria-describedby="graph-help"
        aria-orientation="horizontal"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex items-start gap-2 overflow-x-auto rounded-md border border-border bg-surface-sunken p-4"
      >
        <div className="grid w-52 shrink-0 gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Trigger</h3>
          <button
            type="button"
            role="option"
            aria-selected={selectedId === TRIGGER_NODE_ID}
            tabIndex={selectedId === TRIGGER_NODE_ID ? 0 : -1}
            ref={(node) => {
              if (node) refs.current.set(TRIGGER_NODE_ID, node);
              else refs.current.delete(TRIGGER_NODE_ID);
            }}
            onClick={() => onSelect(TRIGGER_NODE_ID)}
            className={nodeClasses(selectedId === TRIGGER_NODE_ID, false)}
          >
            <span className="flex items-center gap-2 font-medium">
              <Zap aria-hidden="true" className="size-4 text-accent-text" />
              {TRIGGER_TYPE_LABELS[trigger.type]}
            </span>
          </button>
        </div>
        {[...columns.entries()].map(([depth, items]) => (
          <Fragment key={depth}>
            <ChevronRight
              aria-hidden="true"
              className="mt-9 size-5 shrink-0 text-fg-subtle rtl:rotate-180"
            />
            <div className="grid w-60 shrink-0 gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
                Step {depth}
              </h3>
              {items.map(({ step }) => {
                const selected = step.id === selectedId;
                const hasIssue = issueIds.has(step.id);
                const links = outgoing(step.id, edges, names);
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    ref={(node) => {
                      if (node) refs.current.set(step.id, node);
                      else refs.current.delete(step.id);
                    }}
                    onClick={() => onSelect(step.id)}
                    className={nodeClasses(selected, hasIssue)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium">{step.name}</span>
                      {hasIssue ? (
                        <Badge tone="critical" size="sm" icon={<TriangleAlert />}>
                          Needs attention
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-sm text-fg-muted">{STEP_TYPE_LABELS[step.type]}</span>
                    {links.length > 0 ? (
                      <span className="font-mono text-xs text-fg-muted">{links.join(" · ")}</span>
                    ) : (
                      <span className="text-xs text-fg-subtle">Ends here</span>
                    )}
                  </button>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-fg-muted">No steps yet. Add the first step below.</p>
      ) : null}
      {issues.length > 0 ? (
        <ul aria-label="Graph problems" className="grid gap-1">
          {issues.map((issue) => (
            <li
              key={`${issue.code}-${issue.stepId ?? issue.message}`}
              className="flex items-start gap-1.5 text-sm font-medium text-critical"
            >
              <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
