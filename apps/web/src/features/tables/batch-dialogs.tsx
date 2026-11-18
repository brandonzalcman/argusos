import type { FieldDefinition, RecordEnvelope } from "@argus/schema";
import { Button, Dialog, DialogContent, Field, Input, StatusPill } from "@argus/ui";
import { type ReactElement, useMemo, useState } from "react";
import {
  type BulkPlan,
  isBulkEditable,
  type PastePlan,
  type PlannedUpdate,
  planBulk,
} from "./batch-model.js";
import { NativeSelect } from "./controls.js";
import { formatCellValue } from "./grid-model.js";

/** Rows beyond this need a server-side job rather than one browser session sending batches. */
export const BULK_ROW_LIMIT = 5_000;

export interface PasteDialogProps {
  readonly plan: PastePlan | null;
  readonly recordLabel: (recordId: string) => string;
  readonly applying: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (updates: readonly PlannedUpdate[]) => void;
}

/** Review step for a paste: what will change, what was skipped and why. Nothing is sent until confirmed. */
export function PasteDialog({
  plan,
  recordLabel,
  applying,
  onCancel,
  onConfirm,
}: PasteDialogProps): ReactElement {
  const open = plan !== null;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !applying && onCancel()}>
      {plan ? (
        <DialogContent
          title="Paste into table"
          description="Review the pasted values before they are queued. Each row is checked against the version you are looking at."
          size="lg"
          preventOutsideClose
          footer={
            <>
              <Button variant="secondary" disabled={applying} onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={applying}
                disabled={plan.changedCells === 0}
                onClick={() => onConfirm(plan.updates)}
              >
                Apply {plan.changedCells} change{plan.changedCells === 1 ? "" : "s"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3 text-sm">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              <li>
                <StatusPill
                  status={plan.changedCells > 0 ? "ok" : "stale"}
                  label={`${plan.changedCells} to change in ${plan.updates.length} row${plan.updates.length === 1 ? "" : "s"}`}
                  size="sm"
                />
              </li>
              {plan.unchangedCells > 0 ? (
                <li>
                  <StatusPill
                    status="stale"
                    label={`${plan.unchangedCells} already match`}
                    size="sm"
                  />
                </li>
              ) : null}
              {plan.readOnlyCells > 0 ? (
                <li>
                  <StatusPill
                    status="medium"
                    label={`${plan.readOnlyCells} read-only skipped`}
                    size="sm"
                  />
                </li>
              ) : null}
              {plan.overflowRows > 0 ? (
                <li>
                  <StatusPill
                    status="medium"
                    label={`${plan.overflowRows} row${plan.overflowRows === 1 ? "" : "s"} past the end ignored`}
                    size="sm"
                  />
                </li>
              ) : null}
              {plan.issues.length > 0 ? (
                <li>
                  <StatusPill status="critical" label={`${plan.issues.length} invalid`} size="sm" />
                </li>
              ) : null}
            </ul>
            {plan.issues.length > 0 ? (
              <div role="alert" className="grid gap-1">
                <p className="font-medium text-critical">Invalid cells are skipped:</p>
                <ul className="m-0 max-h-40 list-disc overflow-auto ps-5">
                  {plan.issues.slice(0, 20).map((issue) => (
                    <li key={`${issue.recordId}:${issue.fieldName}:${issue.message}`}>
                      {recordLabel(issue.recordId)} · {issue.fieldName}: {issue.message}
                    </li>
                  ))}
                </ul>
                {plan.issues.length > 20 ? (
                  <p className="text-fg-muted">…and {plan.issues.length - 20} more.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export interface BulkEditDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly fields: readonly FieldDefinition[];
  /** Rows in the current filtered view. */
  readonly records: readonly RecordEnvelope[];
  readonly applying: boolean;
  readonly onConfirm: (updates: readonly PlannedUpdate[], label: string) => void;
}

function ValueInput({
  field,
  value,
  onChange,
}: {
  readonly field: FieldDefinition;
  readonly value: string;
  readonly onChange: (v: string) => void;
}): ReactElement {
  if (field.type === "boolean") {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(empty)</option>
        <option value="true">{field.config.trueLabel}</option>
        <option value="false">{field.config.falseLabel}</option>
      </NativeSelect>
    );
  }
  if (field.type === "single-select" || field.type === "status") {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(empty)</option>
        {field.config.options
          .filter((o) => !o.archived)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
      </NativeSelect>
    );
  }
  const type =
    field.type === "date"
      ? "date"
      : ["number", "currency", "percent", "duration"].includes(field.type)
        ? "number"
        : "text";
  return (
    <Input
      type={type}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.type === "multi-select" ? "Option names, comma-separated" : undefined}
    />
  );
}

/**
 * Sets one field to one value on every row of the current view, after an explicit count-bearing confirmation.
 * TODO(implementation): server-side bulk-by-filter job (Graphile Worker) for views above BULK_ROW_LIMIT rows.
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  fields,
  records,
  applying,
  onConfirm,
}: BulkEditDialogProps): ReactElement {
  const editable = useMemo(() => fields.filter(isBulkEditable), [fields]);
  const [fieldId, setFieldId] = useState("");
  const [raw, setRaw] = useState("");
  const field = editable.find((f) => f.id === fieldId) ?? null;
  const plan: BulkPlan | null = useMemo(
    () => (field ? planBulk(records, field, raw) : null),
    [field, records, raw],
  );
  const tooMany = plan?.ok === true && plan.updates.length > BULK_ROW_LIMIT;
  const canApply = plan?.ok === true && plan.updates.length > 0 && !tooMany;

  return (
    <Dialog open={open} onOpenChange={(next) => !applying && onOpenChange(next)}>
      <DialogContent
        title="Bulk edit"
        description={`Set one field on all ${records.length.toLocaleString()} rows in this view.`}
        size="md"
        preventOutsideClose
        footer={
          <>
            <Button variant="secondary" disabled={applying} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={applying}
              disabled={!canApply}
              onClick={() =>
                plan?.ok && field ? onConfirm(plan.updates, `Bulk edit ${field.name}`) : undefined
              }
            >
              {plan?.ok
                ? `Update ${plan.updates.length.toLocaleString()} row${plan.updates.length === 1 ? "" : "s"}`
                : "Update rows"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Field">
            <NativeSelect
              value={fieldId}
              onChange={(e) => {
                setFieldId(e.target.value);
                setRaw("");
              }}
            >
              <option value="">Choose a field…</option>
              {editable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {field ? (
            <Field label="New value" {...(plan && !plan.ok ? { error: plan.message } : {})}>
              <ValueInput field={field} value={raw} onChange={setRaw} />
            </Field>
          ) : null}
          {plan?.ok ? (
            <p role="status" className="text-sm text-fg-muted">
              {plan.updates.length.toLocaleString()} row{plan.updates.length === 1 ? "" : "s"} will
              change
              {plan.unchangedRows > 0
                ? `; ${plan.unchangedRows.toLocaleString()} already ${
                    formatCellValue(field as FieldDefinition, raw) || "empty"
                  }`
                : ""}
              . Each row is checked against the version you see; rows changed by someone else are
              reported as conflicts, not overwritten.
            </p>
          ) : null}
          {tooMany ? (
            <p role="alert" className="text-sm text-critical">
              More than {BULK_ROW_LIMIT.toLocaleString()} rows. Narrow the filter; larger changes
              need a server-side job.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
