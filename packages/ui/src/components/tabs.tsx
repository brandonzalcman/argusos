import { Tabs as TabsPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps {
  readonly children: ReactNode;
  /** Accessible name for the tab set, e.g. "Incident sections". */
  readonly "aria-label": string;
  readonly className?: string;
}

/** Underlined tab row. Arrow keys move between tabs; Home/End jump to the ends. */
export function TabsList({ children, className, ...props }: TabsListProps): ReactElement {
  return (
    <TabsPrimitive.List
      {...props}
      className={cn("flex items-end gap-1 overflow-x-auto border-b border-border", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export interface TabsTriggerProps {
  readonly value: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  /** Optional count, e.g. open tasks. Announced as part of the tab name. */
  readonly count?: number;
  readonly className?: string;
}

export function TabsTrigger({
  children,
  count,
  className,
  ...props
}: TabsTriggerProps): ReactElement {
  return (
    <TabsPrimitive.Trigger
      {...props}
      className={cn(
        "relative -mb-px inline-flex h-(--argus-control-h) items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-base font-medium text-fg-muted",
        "transition-colors duration-(--argus-duration-fast)",
        "hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg",
        "disabled:pointer-events-none disabled:opacity-50",
        focusRing,
        "focus-visible:-outline-offset-2",
        className,
      )}
    >
      {children}
      {count !== undefined ? (
        <span className="rounded-full bg-surface-sunken px-1.5 text-xs tabular-nums text-fg-muted">
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export interface TabsContentProps {
  readonly value: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function TabsContent({ className, ...props }: TabsContentProps): ReactElement {
  return (
    <TabsPrimitive.Content {...props} className={cn("pt-(--argus-gap) outline-none", className)} />
  );
}
