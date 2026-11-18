import { Popover as PopoverPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export interface PopoverContentProps {
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  readonly sideOffset?: number;
  /** Accessible name for the popover region when it has no heading. */
  readonly "aria-label"?: string;
  readonly className?: string;
}

/**
 * Non-modal floating panel for filters, quick details and small forms. Focus moves in on open
 * and returns to the trigger on close; Escape and outside clicks close it.
 */
export function PopoverContent({
  children,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  className,
  "aria-label": ariaLabel,
}: PopoverContentProps): ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        aria-label={ariaLabel}
        className={cn(
          "z-(--argus-z-popover) w-72 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-surface-raised p-(--argus-panel-p) text-fg shadow-md outline-none",
          "data-[state=open]:animate-argus-pop-in",
          className,
        )}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
