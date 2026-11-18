import { Switch as SwitchPrimitive } from "radix-ui";
import { type ReactElement, type ReactNode, useId } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";

export interface SwitchProps {
  /** Visible label naming the setting (not the state). */
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly id?: string;
  readonly "aria-label"?: string;
  /** Show "On"/"Off" text beside the track so state never relies on colour/position alone. */
  readonly showStateLabel?: boolean;
  readonly className?: string;
}

/** Immediate on/off setting. For choices applied on submit, use Checkbox instead. */
export function Switch({
  label,
  description,
  id,
  className,
  showStateLabel = true,
  "aria-label": ariaLabel,
  ...rootProps
}: SwitchProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {label ? (
        <div className="grid gap-0.5">
          <label htmlFor={controlId} className="text-base text-fg">
            {label}
          </label>
          {description ? (
            <p id={descriptionId} className="text-sm text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <SwitchPrimitive.Root
          id={controlId}
          aria-label={ariaLabel}
          aria-describedby={descriptionId}
          {...rootProps}
          className={cn(
            "group peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border-strong bg-surface-sunken",
            "transition-colors duration-(--argus-duration-fast)",
            "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
          )}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "block size-3.5 translate-x-0.5 rounded-full bg-fg-muted shadow-sm rtl:-translate-x-0.5",
              "transition-transform duration-(--argus-duration-fast) ease-out",
              "data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-on-accent rtl:data-[state=checked]:-translate-x-4.5",
            )}
          />
        </SwitchPrimitive.Root>
        {showStateLabel ? (
          <span
            aria-hidden="true"
            className="w-6 text-sm text-fg-muted peer-data-[state=checked]:hidden"
          >
            Off
          </span>
        ) : null}
        {showStateLabel ? (
          <span
            aria-hidden="true"
            className="hidden w-6 text-sm font-medium text-fg peer-data-[state=checked]:inline"
          >
            On
          </span>
        ) : null}
      </div>
    </div>
  );
}
