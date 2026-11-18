import { Badge, Button, Field, StatusPill, type StatusPillProps, Textarea } from "@argus/ui";
import { Play, TriangleAlert } from "@argus/ui/icons";
import { type ReactElement, useState } from "react";
import { ErrorState } from "./status-views.js";
import { useWorkflowDryRun } from "./workflow-queries.js";
import type { WorkflowDryRunResult } from "./workflow-service.js";

const STEP_STATUS: Readonly<
  Record<
    WorkflowDryRunResult["steps"][number]["status"],
    { status: StatusPillProps["status"]; label: string }
  >
> = {
  executed: { status: "ok", label: "Executed" },
  skipped: { status: "stale", label: "Skipped" },
  "would-wait": { status: "info", label: "Would wait" },
  failed: { status: "critical", label: "Failed" },
};

/** Parses sample-record JSON; returns an object or a human-readable error. */
export function parseSampleRecord(
  text: string,
):
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly error: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Sample record must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

/** Presentational step-by-step dry-run result. */
export function DryRunResultView({
  result,
}: {
  readonly result: WorkflowDryRunResult;
}): ReactElement {
  return (
    <div className="grid gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          status={result.outcome === "succeeded" ? "ok" : "critical"}
          label={result.outcome === "succeeded" ? "Dry run succeeded" : "Dry run failed"}
        />
        <span className="text-sm text-fg-muted">
          Evaluated saved version {result.evaluatedDefinitionVersion}; no alerts, webhooks or record
          writes were performed.
        </span>
      </div>
      <ol aria-label="Step-by-step dry-run log" className="grid gap-2">
        {result.steps.map((step) => {
          const view = STEP_STATUS[step.status];
          return (
            <li
              key={step.stepId}
              className="grid gap-1 rounded-md border border-border bg-surface-sunken p-2.5"
            >
              <span className="flex flex-wrap items-center gap-2">
                <StatusPill status={view.status} label={view.label} size="sm" />
                <span className="font-mono text-xs text-fg-muted">{step.durationMs} ms</span>
                {step.branchTaken ? (
                  <Badge tone="neutral" variant="outline" size="sm">
                    Branch “{step.branchTaken}”
                  </Badge>
                ) : null}
              </span>
              <span className="text-base text-fg">{step.detail}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export interface DryRunPanelProps {
  readonly workflowId: string;
  /** Saved version the server will evaluate; dry runs never use unsaved edits. */
  readonly savedVersion: number;
  readonly hasUnsavedChanges: boolean;
}

/** Sample-record input, run action and result display for a side-effect-free test run. */
export function DryRunPanel({
  workflowId,
  savedVersion,
  hasUnsavedChanges,
}: DryRunPanelProps): ReactElement {
  const [text, setText] = useState("{}");
  const [parseError, setParseError] = useState<string | null>(null);
  const mutation = useWorkflowDryRun(workflowId);

  const run = (): void => {
    const parsed = parseSampleRecord(text);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    mutation.mutate({ definitionVersion: savedVersion, sampleRecord: parsed.value });
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm text-fg-muted">
        Evaluates saved version {savedVersion} against a sample record. Nothing is sent or written.
      </p>
      {hasUnsavedChanges ? (
        <p role="status" className="flex items-start gap-1.5 text-sm font-medium text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          You have unsaved edits; save the draft first — the dry run ignores them.
        </p>
      ) : null}
      <Field label="Sample record (JSON)" {...(parseError ? { error: parseError } : {})}>
        <Textarea
          rows={5}
          spellCheck={false}
          value={text}
          className="font-mono text-sm"
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <div>
        <Button
          variant="primary"
          onClick={run}
          loading={mutation.isPending}
          leadingIcon={<Play aria-hidden="true" />}
        >
          {mutation.isPending ? "Running…" : "Run dry run"}
        </Button>
      </div>
      {mutation.isError ? (
        <ErrorState title="Dry run failed to start" error={mutation.error} onRetry={run} />
      ) : null}
      {mutation.data ? <DryRunResultView result={mutation.data} /> : null}
    </div>
  );
}
