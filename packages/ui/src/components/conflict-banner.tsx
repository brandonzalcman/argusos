import { GitCompareArrows } from "lucide-react";
import { type ReactElement, useId } from "react";
import { Button } from "./button.js";

export interface ConflictField {
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly localValue: string;
  readonly serverValue: string;
}

export interface ConflictBannerProps {
  readonly recordLabel: string;
  readonly fields: readonly ConflictField[];
  readonly onReview?: () => void;
  readonly onKeepMine?: () => void;
  readonly onKeepTheirs?: () => void;
}

/**
 * Surfaces same-field optimistic-write conflicts with both values visible.
 * Input: an authorized record label, field-level local/server values, and resolution callbacks.
 * Output: an alert region; resolution and audit writes are left to the mutation queue port.
 * Errors: callback errors propagate; the component never silently selects a winning value.
 * Depends on: server conflict metadata. Callers must redact fields hidden by field-level security.
 */
export function ConflictBanner({
  recordLabel,
  fields,
  onReview,
  onKeepMine,
  onKeepTheirs,
}: ConflictBannerProps): ReactElement {
  const headingId = useId();
  return (
    <section
      role="alert"
      aria-labelledby={headingId}
      className="grid gap-3 rounded-md border border-warning-solid bg-warning-subtle p-4 text-fg"
    >
      <div className="flex items-start gap-3">
        <GitCompareArrows aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="grid gap-0.5">
          <h2 id={headingId} className="text-base font-semibold">
            Changes need review: {recordLabel}
          </h2>
          <p className="text-sm text-fg-muted">
            Someone else changed the same fields. Your queued changes were not overwritten.
          </p>
        </div>
      </div>
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            <th scope="col" className="pe-3 text-start font-semibold">
              Field
            </th>
            <th scope="col" className="pe-2 text-start font-semibold">
              Your value
            </th>
            <th scope="col" className="text-start font-semibold">
              Current value
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.fieldId}>
              <th scope="row" className="pe-3 text-start font-medium">
                {field.fieldLabel}
              </th>
              <td className="pe-2">
                <span className="block rounded-sm border border-border bg-surface px-2 py-1">
                  {field.localValue}
                </span>
              </td>
              <td>
                <span className="block rounded-sm border border-border bg-surface px-2 py-1">
                  {field.serverValue}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {onReview || onKeepMine || onKeepTheirs ? (
        <div className="flex flex-wrap gap-2">
          {onKeepMine ? (
            <Button size="sm" variant="primary" onClick={onKeepMine}>
              Keep mine
            </Button>
          ) : null}
          {onKeepTheirs ? (
            <Button size="sm" onClick={onKeepTheirs}>
              Keep theirs
            </Button>
          ) : null}
          {onReview ? (
            <Button size="sm" variant="ghost" onClick={onReview}>
              Review conflicting changes
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
