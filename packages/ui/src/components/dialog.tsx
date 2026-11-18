import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactElement, type ReactNode, useState } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { IconButton } from "./icon-button.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Readonly<Record<DialogSize, string>> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export interface DialogContentProps {
  /** Required accessible title, rendered as the dialog heading. */
  readonly title: ReactNode;
  /** Optional description announced when the dialog opens. */
  readonly description?: ReactNode;
  readonly size?: DialogSize;
  /** Footer actions (right-aligned). Put the primary action last. */
  readonly footer?: ReactNode;
  /** Hide the corner close button (Escape still closes). */
  readonly hideClose?: boolean;
  readonly className?: string;
  readonly children?: ReactNode;
  /** Prevent closing by clicking the overlay, e.g. while a form has unsaved changes. */
  readonly preventOutsideClose?: boolean;
}

/**
 * Modal surface: traps focus, restores it on close, closes on Escape, and labels itself from
 * `title`/`description`. Never open a dialog from inside another dialog.
 */
export function DialogContent({
  title,
  description,
  size = "md",
  footer,
  hideClose = false,
  className,
  children,
  preventOutsideClose = false,
}: DialogContentProps): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-(--argus-z-overlay) bg-overlay data-[state=open]:animate-argus-fade-in" />
      <DialogPrimitive.Content
        {...(preventOutsideClose
          ? { onPointerDownOutside: (event) => event.preventDefault() }
          : {})}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed start-1/2 top-1/2 z-(--argus-z-modal) flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rtl:translate-x-1/2",
          "rounded-lg border border-border bg-surface-raised text-fg shadow-lg outline-none",
          "data-[state=open]:animate-argus-pop-in",
          sizeClasses[size],
          className,
        )}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="grid min-w-0 flex-1 gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-fg">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-base text-fg-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close asChild>
              <IconButton label="Close dialog" icon={<X />} size="sm" className="-me-1.5 -mt-0.5" />
            </DialogPrimitive.Close>
          )}
        </header>
        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        ) : null}
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3 rounded-b-lg">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  /** Name of the affected item; always shown so the operator confirms the right thing. */
  readonly itemName: string;
  readonly description?: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  /** May return a promise; the confirm button shows progress until it settles. */
  readonly onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation for consequential actions. Destructive confirmations name the item and use the
 * danger button; prefer an undo toast over confirmation when the action is reversible.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps): ReactElement {
  const [pending, setPending] = useState(false);
  const confirm = async (): Promise<void> => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={pending ? () => undefined : onOpenChange}>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        preventOutsideClose
        footer={
          <>
            <DialogClose asChild>
              <Button disabled={pending}>{cancelLabel}</Button>
            </DialogClose>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={pending}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-base text-fg">
          <span className="text-fg-muted">Item: </span>
          <strong className="font-semibold break-words">{itemName}</strong>
        </p>
      </DialogContent>
    </Dialog>
  );
}
