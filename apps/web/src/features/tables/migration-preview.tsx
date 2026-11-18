import type { MigrationOperation, MigrationPreview } from "@argus/ddl-engine";
import { type ReactElement, useId, useState } from "react";
import "./tables.css";

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
 * Plain-words DDL plan diff with an apply-with-confirmation step.
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
  const headingId = useId();
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const destructiveIds = plan.diff.destructiveOperationIds;
  const destructive = plan.impact.destructive || destructiveIds.length > 0;
  const failedConversions = plan.preflight.reduce((n, p) => n + p.failedRows, 0);
  const expired = Date.parse(plan.expiresAt) < Date.now();
  const blocked = !preview.canPublish || expired;
  const confirmed = !destructive || (typed === tableName && understood);

  return (
    <section className="argus-panel argus-stack" aria-labelledby={headingId}>
      <h2 id={headingId}>Schema change preview</h2>
      <p className="argus-muted">
        Planned by the DDL engine against live version{" "}
        <span className="tbl-mono">{plan.baseLiveVersion ?? "none"}</span>. SQL is generated and run
        by the engine in one transaction; it is not shown or editable here.
      </p>

      {plan.diff.operations.length === 0 ? (
        <p role="status">No schema changes to apply.</p>
      ) : (
        <ol className="tbl-plan" aria-label="Planned changes">
          {plan.diff.operations.map((op) => {
            const isDestructive = destructiveIds.includes(op.operationId);
            const check = plan.preflight.find((p) => p.operationId === op.operationId);
            return (
              <li key={op.operationId} data-destructive={isDestructive || undefined}>
                <strong>{operationLabels[op.kind]}</strong>
                {isDestructive ? (
                  <span className="tbl-tag tbl-tag--danger">
                    {" "}
                    Destructive (retained, restorable)
                  </span>
                ) : null}
                <div>{op.summary}</div>
                {check ? (
                  <div role={check.failedRows > 0 ? "alert" : "status"}>
                    {check.failedRows > 0
                      ? `${check.failedRows.toLocaleString()} of ${check.scannedRows.toLocaleString()} rows cannot be converted${check.truncated ? " (sample truncated)" : ""}. Publishing is blocked until they are fixed.`
                      : `All ${check.scannedRows.toLocaleString()} scanned rows convert cleanly.`}
                    {check.samples.length > 0 ? (
                      <ul>
                        {check.samples.map((s) => (
                          <li key={s.recordId}>
                            <span className="tbl-mono">{s.recordId}</span> — {s.reasonCode}
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

      <dl className="tbl-impact">
        <div>
          <dt>Estimated rows touched</dt>
          <dd>{plan.impact.estimatedRows?.toLocaleString() ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Estimated lock time</dt>
          <dd>
            {plan.impact.estimatedLockMilliseconds === null
              ? "Unknown"
              : `${plan.impact.estimatedLockMilliseconds} ms`}
          </dd>
        </div>
        <div>
          <dt>Affects active incidents</dt>
          <dd>{plan.impact.affectsActiveIncidents ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Needs maintenance window</dt>
          <dd>{plan.impact.requiresMaintenanceWindow ? "Yes" : "No"}</dd>
        </div>
      </dl>

      {preview.warnings.length > 0 ? (
        <ul role="alert" className="tbl-issues" aria-label="Warnings">
          {preview.warnings.map((w) => (
            <li key={`${w.code}:${w.message}`}>{w.message}</li>
          ))}
        </ul>
      ) : null}

      <details>
        <summary>Execution steps ({plan.steps.length})</summary>
        <ol>
          {[...plan.steps]
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((step) => (
              <li key={step.stepId}>
                <span className="tbl-tag">{step.phase}</span> {step.description}
                {step.requiresExclusiveLock ? " (exclusive lock)" : ""}
              </li>
            ))}
        </ol>
      </details>

      {expired ? (
        <p role="alert">This plan has expired. Preview the changes again before applying.</p>
      ) : null}
      {failedConversions > 0 ? (
        <p role="alert">Fix the rows that fail conversion, then preview again.</p>
      ) : null}

      {!confirming ? (
        <div className="argus-cluster">
          <button
            type="button"
            className="tbl-button tbl-button--primary"
            disabled={blocked || plan.diff.operations.length === 0}
            onClick={() => setConfirming(true)}
          >
            Review and apply…
          </button>
          <button type="button" className="tbl-button" onClick={onDiscard}>
            Discard preview
          </button>
        </div>
      ) : (
        <fieldset aria-labelledby={confirmId} className="argus-panel argus-stack">
          <legend id={confirmId}>Confirm schema change</legend>
          <p>
            Apply {plan.diff.operations.length} change
            {plan.diff.operations.length === 1 ? "" : "s"} to <strong>{tableName}</strong>. This
            publishes a new version you can roll back to, and is recorded in the audit log.
          </p>
          {destructive ? (
            <>
              <p>
                Removed fields are hidden and retained, not erased, so undo stays instant during the
                retention period.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                />{" "}
                I understand which changes are destructive and how long data is retained.
              </label>
              <label>
                Type the table name <strong>{tableName}</strong> to confirm
                <input
                  className="tbl-input"
                  value={typed}
                  autoComplete="off"
                  onChange={(e) => setTyped(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <div className="argus-cluster">
            <button
              type="button"
              className="tbl-button tbl-button--primary"
              disabled={!confirmed || applying || blocked}
              onClick={() => onApply(destructiveIds)}
            >
              {applying ? "Applying…" : "Apply schema change"}
            </button>
            <button
              type="button"
              className="tbl-button"
              disabled={applying}
              onClick={() => setConfirming(false)}
            >
              Back
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
