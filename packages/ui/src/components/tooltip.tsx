import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Kbd } from "./kbd.js";

export interface TooltipProviderProps {
  readonly children: ReactNode;
  /** Delay before showing, in ms. Defaults to 400 so tooltips never flicker while scanning. */
  readonly delayDuration?: number;
}

/** Mount once near the app root (AppShell and Storybook already do). */
export function TooltipProvider({
  children,
  delayDuration = 400,
}: TooltipProviderProps): ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  /** Supplementary text. Never the only accessible name of a control. */
  readonly content: ReactNode;
  /** A single focusable element. */
  readonly children: ReactElement;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  /** Keyboard shortcut shown after the text, e.g. ["Ctrl", "K"]. */
  readonly shortcut?: readonly string[];
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * Hover/focus hint for a control. Opens on keyboard focus, closes on Escape, and is exposed as
 * the trigger's description. Requires a TooltipProvider ancestor.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  shortcut,
  ...rootProps
}: TooltipProps): ReactElement {
  return (
    <TooltipPrimitive.Root {...rootProps}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-(--argus-z-tooltip) flex max-w-xs items-center gap-2 rounded-sm px-2 py-1",
            "bg-fg text-xs font-medium text-surface shadow-md",
            "data-[state=delayed-open]:animate-argus-fade-in",
          )}
        >
          <span>{content}</span>
          {shortcut && shortcut.length > 0 ? (
            <span className="flex gap-0.5 opacity-80">
              {shortcut.map((key) => (
                <Kbd key={key} tone="inverse">
                  {key}
                </Kbd>
              ))}
            </span>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
