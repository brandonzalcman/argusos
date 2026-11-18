import { Button, Dialog, DialogContent } from "@argus/ui";
import type { ReactElement, ReactNode } from "react";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly tone?: "primary" | "danger";
  readonly confirmDisabled?: boolean;
  readonly pending?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly children: ReactNode;
}

/**
 * Modal confirmation built on the @argus/ui Dialog (Radix): focus is trapped, Escape cancels and
 * focus returns to the opener. Used for publish and rollback, which are audited and affect live
 * boards. It hosts a form (summary, typed name) so it wraps @argus/ui `DialogContent` directly.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  tone = "primary",
  confirmDisabled = false,
  pending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent
        title={title}
        size="md"
        preventOutsideClose={pending}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
