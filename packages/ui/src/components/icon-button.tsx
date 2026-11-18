import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from "react";
import { cn } from "../lib/cn.js";
import { type ButtonSize, type ButtonVariant, buttonClasses } from "./button.js";
import { Tooltip } from "./tooltip.js";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Required accessible name; also shown as the tooltip. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: Exclude<ButtonVariant, "link">;
  readonly size?: ButtonSize;
  /** Keyboard shortcut appended to the tooltip. */
  readonly shortcut?: readonly string[];
  /** Set false only when a visible text label sits right next to the button. */
  readonly showTooltip?: boolean;
  readonly tooltipSide?: "top" | "right" | "bottom" | "left";
  readonly ref?: Ref<HTMLButtonElement>;
}

const squareSize: Readonly<Record<ButtonSize, string>> = {
  sm: "w-(--argus-control-h-sm) px-0",
  md: "w-(--argus-control-h) px-0",
  lg: "w-(--argus-control-h-lg) px-0",
};

/**
 * Square icon-only button. Always has an accessible name (`label`) and a tooltip, so icon-only
 * actions are never unlabeled.
 */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  shortcut,
  showTooltip = true,
  tooltipSide = "bottom",
  className,
  type,
  ref,
  ...props
}: IconButtonProps): ReactElement {
  const button = (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      className={buttonClasses(variant, size, cn(squareSize[size], className))}
      {...props}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
    </button>
  );
  if (!showTooltip) {
    return button;
  }
  return (
    <Tooltip content={label} side={tooltipSide} {...(shortcut ? { shortcut } : {})}>
      {button}
    </Tooltip>
  );
}
