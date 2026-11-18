import { Rows3, Rows4 } from "lucide-react";
import { type ReactElement, useId } from "react";
import { cn } from "../lib/cn.js";
import type { Density } from "../tokens.js";

export interface DensityControlProps {
  readonly value: Density;
  readonly onChange: (density: Density) => void;
  /** Group label; visually hidden when `hideLabel` is set (e.g. in the top bar). */
  readonly label?: string;
  readonly hideLabel?: boolean;
  /** Show icons only (labels remain available to assistive tech). */
  readonly iconOnly?: boolean;
}

const options = [
  { value: "comfortable", label: "Comfortable", Icon: Rows3 },
  { value: "compact", label: "Compact", Icon: Rows4 },
] as const;

/**
 * Comfortable/compact segmented control built on native radios (arrow keys move the choice).
 * Persistence belongs to UIPreferencesProvider or the host.
 */
export function DensityControl({
  value,
  onChange,
  label = "Display density",
  hideLabel = false,
  iconOnly = false,
}: DensityControlProps): ReactElement {
  const name = useId();
  return (
    <fieldset className="flex items-center gap-2 border-0 p-0">
      <legend
        className={cn("float-start me-2 text-sm font-medium text-fg-muted", hideLabel && "sr-only")}
      >
        {label}
      </legend>
      <div className="inline-flex rounded-sm border border-border bg-surface-sunken p-0.5">
        {options.map(({ value: option, label: optionLabel, Icon }) => (
          <label
            key={option}
            title={iconOnly ? optionLabel : undefined}
            className={cn(
              "relative inline-flex h-(--argus-control-h-sm) cursor-pointer items-center gap-1.5 rounded-[3px] px-2 text-sm font-medium text-fg-subtle",
              "transition-colors duration-(--argus-duration-fast) hover:text-fg",
              "has-checked:bg-surface has-checked:text-accent-text has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" />
            <span className={cn(iconOnly && "sr-only")}>{optionLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
