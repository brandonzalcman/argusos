import type { PluginCapability } from "@argus/schema";
import { Badge, Button, Dialog, DialogClose, DialogContent, Field, Textarea } from "@argus/ui";
import { ShieldAlert } from "@argus/ui/icons";
import { type ReactElement, useState } from "react";
import { requiresAdminApproval, summarizeCapability } from "./capabilities-model.js";

export interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly componentName: string;
  readonly capabilities: readonly PluginCapability[];
  readonly pending: boolean;
  readonly error: string | null;
  readonly onConfirm: (changeSummary: string) => void;
}

/**
 * Publish confirmation: shows the component name, the capabilities being published (reviewed by
 * the publisher) and a required change summary. A dialog rather than ConfirmDialog because it
 * needs a form body.
 */
export function PublishDialog({
  open,
  onOpenChange,
  componentName,
  capabilities,
  pending,
  error,
  onConfirm,
}: PublishDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={pending ? () => undefined : onOpenChange}>
      {open ? (
        <PublishDialogBody
          componentName={componentName}
          capabilities={capabilities}
          pending={pending}
          error={error}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}

function PublishDialogBody({
  componentName,
  capabilities,
  pending,
  error,
  onConfirm,
}: Omit<PublishDialogProps, "open" | "onOpenChange">): ReactElement {
  const [summary, setSummary] = useState("");
  const valid = summary.trim().length > 0;
  return (
    <DialogContent
      size="md"
      title="Publish component"
      description="Publishing makes this version available to boards and pages that pin it."
      preventOutsideClose
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending}>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={pending}
            disabled={!valid}
            onClick={() => onConfirm(summary.trim())}
          >
            Publish
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-base text-fg">
          <span className="text-fg-muted">Item: </span>
          <strong className="font-semibold break-words">{componentName}</strong>
        </p>
        <section aria-label="Capabilities being published" className="grid gap-2">
          <h3 className="text-sm font-semibold text-fg">Capabilities being published</h3>
          {capabilities.length === 0 ? (
            <p className="text-sm text-fg-muted">
              None. This component can't read or change any data.
            </p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {capabilities.map((capability) => (
                <li key={capability.type} className="flex flex-wrap items-center gap-2">
                  <span>{summarizeCapability(capability)}</span>
                  {requiresAdminApproval(capability) ? (
                    <Badge tone="warning" icon={<ShieldAlert />}>
                      Requires administrator approval
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <Field
          label="Change summary"
          description="Shown in the version history and the audit log."
          required
        >
          <Textarea
            rows={3}
            value={summary}
            maxLength={2000}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        ) : null}
      </div>
    </DialogContent>
  );
}
