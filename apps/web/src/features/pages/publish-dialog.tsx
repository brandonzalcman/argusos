import { Button, Dialog, DialogContent, Field, Textarea } from "@argus/ui";
import { type ReactElement, useEffect, useState } from "react";

export interface PublishDialogProps {
  readonly open: boolean;
  readonly pageTitle: string;
  readonly slug: string;
  /** Plain-language list of what will change (see summarizePageChanges). */
  readonly changes: readonly string[];
  /** Blocking problems; publishing is disabled while any remain. */
  readonly problems: readonly string[];
  readonly unsaved: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onConfirm: (changeSummary: string) => void;
  readonly onCancel: () => void;
}

/** Publish confirmation: change summary (audited), what changes, and blocking problems. */
export function PublishDialog({
  open,
  pageTitle,
  slug,
  changes,
  problems,
  unsaved,
  pending,
  error,
  onConfirm,
  onCancel,
}: PublishDialogProps): ReactElement {
  const suggested = changes.join(" ").slice(0, 2_000);
  const [summary, setSummary] = useState(suggested);
  useEffect(() => {
    if (open) setSummary(suggested);
  }, [open, suggested]);
  const blank = summary.trim() === "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent
        title={`Publish “${pageTitle}”`}
        description={`Makes this version live at /p/${slug}. It is recorded in the audit log.`}
        size="md"
        preventOutsideClose={pending}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={blank || problems.length > 0}
              onClick={() => onConfirm(summary.trim())}
            >
              {unsaved ? "Save and publish" : "Publish"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {problems.length > 0 ? (
            <div role="alert" className="rounded-md border border-critical bg-critical-subtle p-3">
              <strong className="text-critical">Fix these before publishing</strong>
              <ul className="mt-1 list-disc ps-5 text-sm">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <section aria-label="Changes" className="grid gap-1">
            <h3 className="text-sm font-semibold text-fg">What changes</h3>
            {changes.length === 0 ? (
              <p className="text-sm text-fg-muted">No differences from the published version.</p>
            ) : (
              <ul className="list-disc ps-5 text-sm">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            )}
          </section>
          <Field label="Change summary" required description="Shown in the version history.">
            <Textarea
              rows={3}
              maxLength={2000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
