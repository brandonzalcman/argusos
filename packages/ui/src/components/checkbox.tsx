import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { type ReactElement, type ReactNode, useId } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";

export type CheckedState = boolean | "indeterminate";

export interface CheckboxProps {
  /** Visible label. Omit only when `aria-label` is given (e.g. table row selection). */
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly checked?: CheckedState;
  readonly defaultChecked?: CheckedState;
  readonly onCheckedChange?: (checked: CheckedState) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly name?: string;
  readonly value?: string;
  readonly id?: string;
  readonly "aria-label"?: string;
  readonly className?: string;
}

/** Checkbox with label, optional description and tri-state (indeterminate) support. */
export function Checkbox({
  label,
  description,
  id,
  className,
  "aria-label": ariaLabel,
  ...rootProps
}: CheckboxProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const box = (
    <CheckboxPrimitive.Root
      id={controlId}
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      {...rootProps}
      className={cn(
        "peer mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface text-on-accent shadow-sm",
        "transition-colors duration-(--argus-duration-fast)",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        !label && className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {rootProps.checked === "indeterminate" ? (
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) {
    return box;
  }
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      {box}
      <div className="grid gap-0.5">
        <label
          htmlFor={controlId}
          className="text-base text-fg peer-disabled:cursor-not-allowed peer-disabled:text-fg-muted"
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-sm text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
