import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "../lib/cn.js";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** `inverse` is for use on the dark tooltip surface. */
  readonly tone?: "default" | "inverse";
}

/** Keyboard key hint, e.g. `<Kbd>Ctrl</Kbd><Kbd>K</Kbd>`. */
export function Kbd({ tone = "default", className, ...props }: KbdProps): ReactElement {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border px-1 font-mono text-xs font-medium",
        tone === "default"
          ? "border-border bg-surface-sunken text-fg-muted"
          : "border-current/30 text-current",
        className,
      )}
      {...props}
    />
  );
}
