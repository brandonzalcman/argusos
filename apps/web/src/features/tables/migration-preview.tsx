import type { MigrationOperation, MigrationPreview } from "@argus/ddl-engine";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Field,
  Input,
  Panel,
  StatusPill,
} from "@argus/ui";
import { type ReactElement, useState } from "react";

const operationLabels: Readonly<Record<MigrationOperation["kind"], string>> = {
  "create-table": "Create table",
  "remove-table": "Remove table",
  "add-field": "Add field",
  "remove-field": "Remove field",
  "rename-field": "Rename field",
  "change-field-type": "Change field type",
  "set-field-default": "Change default",
  "add-index": "Add index",
  "remove-index": "Remove index",
  "add-relation": "Add relation",
  "remove-relation": "Remove relation",
  "change-row-security": "Change row security",
};

export interface MigrationPreviewPanelProps {
  readonly preview: MigrationPreview;
  readonly tableName: string;
  readonly applying: boolean;
  readonly onApply: (acknowledgedDestructiveOperationIds: readonly string[]) => void;
  readonly onDiscard: () => void;
}

/**
 * Plain-words DDL plan diff with an apply-with-confirmation dialog.
 * Shows operation summaries, ordered step descriptions, preflight conversion results and warnings.
 * It deliberately never renders SQL text: statements are generated, parameterised and executed only by
 * the DDL engine inside one transaction.
 */
export function MigrationPreviewPanel({
  preview,
  tableName,
  applying,
  onApply,
  onDiscard,
}: MigrationPreviewPanelProps): ReactElement {
  const { plan } = preview;
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const destructiveIds = plan.diff.destructiveOperationIds;
  const destructive = plan.impact.destructive || destructiveIds.length > 0;
  const failedConversions = plan.preflight.reduce((n, p) => n + p.failedRows, 0);
  const expired = Date.parse(plan.expiresAt) < Date.now();
  const blocked = !preview.canPublish || expired;
  const confirmed = !destructive || (typed === tableName && understood);
  const count = plan.diff.operations.length;

  return (
    <Panel
      title="Schema change preview"
      description={`Planned by the DDL engine against live version ${plan.baseLiveVersion ?? "none"}. SQL is generated and run by the engine in one transaction; it is not shown or editable here.`}
      status={
        blocked ? (
          <StatusPill status="critical" label="Cannot publish" size="sm" />
        ) : (
          <StatusPill status="ok" label="Ready to apply" size="sm" />
        )
      }
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onDiscard}>
            Discard preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={blocked || count === 0}
            onClick={() => setConfirming(true)}
          >
            Review and apply…
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {count === 0 ? (
          <p role="status" className="text-fg-muted">
            No schema changes to apply.
          </p>
        ) : (
          <ol aria-label="Planned changes" className="m-0 grid list-none gap-2 p-0">
            {plan.diff.operations.map((op) => {
              const isDestructive = destructiveIds.includes(op.operationId);
              const check = plan.preflight.find((p) => p.operationId === op.operationId);
              return (
                <li
                  key={op.operationId}
                  className="grid gap-1 rounded-md border border-border bg-surface-sunken p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{operationLabels[op.kind]}</strong>
                    {isDestructive ? (
                      <Badge tone="critical">Destructive · retained, restorable</Badge>
                    ) : null}
                  </div>
                  <div>{op.summary}</div>
                  {check ? (
                    <div role={check.failedRows > 0 ? "alert" : "status"} className="grid gap-1">
                      {check.failedRows > 0 ? (
                        <StatusPill
                          status="critical"
                          size="sm"
                          label={`${check.failedRows.toLocaleString()} of ${check.scannedRows.toLocaleString()} rows cannot convert${check.truncated ? " (sample truncated)" : ""}`}
                        />
                      ) : (
                        <StatusPill
                          status="ok"
                          size="sm"
                          label={`All ${check.scannedRows.toLocaleString()} scanned rows convert`}
                        />
                      )}
                      {check.samples.length > 0 ? (
                        <ul className="m-0 list-disc ps-5">
                          {check.samples.map((s) => (
                            <li key={s.recordId}>
                              <span className="font-mono">{s.recordId}</span> — {s.reasonCode}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
          {(
            [
              ["Estimated rows touched", plan.impact.estimatedRows?.toLocaleString() ?? "Unknown"],
              [
                "Estimated lock time",
                plan.impact.estimatedLockMilliseconds === null
                  ? "Unknown"
                  : `${plan.impact.estimatedLockMilliseconds} ms`,
              ],
              ["Affects active incidents", plan.impact.affectsActiveIncidents ? "Yes" : "No"],
              ["Needs maintenance window", plan.impact.requiresMaintenanceWindow ? "Yes" : "No"],
            ] as const
          ).map(([term, value]) => (
            <div key={term}>
              <dt className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                {term}
              </dt>
              <dd className="m-0 font-mono text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        {preview.warnings.length > 0 ? (
          <ul
            role="alert"
            aria-label="Warnings"
            className="m-0 list-disc rounded-md border border-warning-solid bg-warning-subtle p-3 ps-8 text-sm"
          >
            {preview.warnings.map((w) => (
              <li key={`${w.code}:${w.message}`}>{w.message}</li>
            ))}
          </ul>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Execution steps ({plan.steps.length})
          </summary>
          <ol className="mt-2 grid gap-1 ps-5">
            {[...plan.steps]
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((step) => (
                <li key={step.stepId}>
                  <Badge variant="outline">{step.phase}</Badge> {step.description}
                  {step.requiresExclusiveLock ? " (exclusive lock)" : ""}
                </li>
              ))}
          </ol>
        </details>

        {expired ? (
          <p role="alert" className="text-critical">
            This plan has expired. Preview the changes again before applying.
          </p>
        ) : null}
        {failedConversions > 0 ? (
          <p role="alert" className="text-critical">
            Fix the rows that fail conversion, then preview again.
          </p>
        ) : null}
      </div>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!applying) {
            setConfirming(open);
          }
        }}
      >
        <DialogContent
          title="Confirm schema change"
          description={`Apply ${count} change${count === 1 ? "" : "s"} to “${tableName}”. This publishes a new version you can roll back to and is recorded in the audit log.`}
          size="md"
          preventOutsideClose
          footer={
            <>
              <Button variant="secondary" disabled={applying} onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button
                variant={destructive ? "danger" : "primary"}
                loading={applying}
                disabled={!confirmed || blocked}
                onClick={() => onApply(destructiveIds)}
              >
                Apply schema change
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            {destructive ? (
              <>
                <p className="text-sm">
                  Removed fields are hidden and retained, not erased, so undo stays instant during
                  the retention period.
                </p>
                <Checkbox
                  checked={understood}
                  onCheckedChange={(c) => setUnderstood(c === true)}
                  label="I understand which changes are destructive and how long data is retained."
                />
                <Field label={`Type “${tableName}” to confirm`}>
                  <Input
                    value={typed}
                    autoComplete="off"
                    onChange={(e) => setTyped(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm">
                No destructive changes. The plan is bound to the digest you reviewed; if the table
                changes first, the engine refuses to apply it.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
