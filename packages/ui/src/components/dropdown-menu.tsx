import { Check, ChevronRight, Circle } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const surfaceClasses = cn(
  "z-(--argus-z-popover) min-w-48 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-border bg-surface-raised p-1 text-fg shadow-md",
  "data-[state=open]:animate-argus-pop-in",
);

const itemClasses = cn(
  "relative flex h-(--argus-control-h) cursor-default select-none items-center gap-2 rounded-sm px-2.5 text-base outline-none",
  "data-highlighted:bg-surface-hover data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted",
);

export interface DropdownMenuContentProps {
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
}

/** Action menu. Arrow keys move, typeahead jumps, Escape closes and restores focus. */
export function DropdownMenuContent({
  children,
  side = "bottom",
  align = "end",
  className,
}: DropdownMenuContentProps): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(surfaceClasses, className)}
      >
        {children}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps {
  readonly children: ReactNode;
  readonly onSelect?: (event: Event) => void;
  readonly icon?: ReactNode;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** Destructive items are coloured and should open a ConfirmDialog. */
  readonly destructive?: boolean;
  readonly asChild?: boolean;
  readonly className?: string;
}

export function DropdownMenuItem({
  children,
  icon,
  shortcut,
  destructive = false,
  className,
  ...props
}: DropdownMenuItemProps): ReactElement {
  if (props.asChild) {
    return (
      <MenuPrimitive.Item {...props} className={cn(itemClasses, className)}>
        {children}
      </MenuPrimitive.Item>
    );
  }
  return (
    <MenuPrimitive.Item
      {...props}
      className={cn(
        itemClasses,
        destructive && "text-critical data-highlighted:bg-critical-subtle [&_svg]:text-critical",
        className,
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <span className="ms-6 font-mono text-xs text-fg-subtle">{shortcut}</span> : null}
    </MenuPrimitive.Item>
  );
}

export interface DropdownMenuCheckboxItemProps {
  readonly children: ReactNode;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

export function DropdownMenuCheckboxItem({
  children,
  ...props
}: DropdownMenuCheckboxItemProps): ReactElement {
  return (
    <MenuPrimitive.CheckboxItem {...props} className={cn(itemClasses, "ps-8")}>
      <MenuPrimitive.ItemIndicator className="absolute start-2.5 inline-flex">
        <Check aria-hidden="true" className="text-accent-text!" />
      </MenuPrimitive.ItemIndicator>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export interface DropdownMenuRadioItemProps {
  readonly children: ReactNode;
  readonly value: string;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
}

export function DropdownMenuRadioItem({
  children,
  icon,
  ...props
}: DropdownMenuRadioItemProps): ReactElement {
  return (
    <MenuPrimitive.RadioItem {...props} className={cn(itemClasses, "ps-8")}>
      <MenuPrimitive.ItemIndicator className="absolute start-3 inline-flex">
        <Circle aria-hidden="true" className="size-2! fill-current text-accent-text!" />
      </MenuPrimitive.ItemIndicator>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <MenuPrimitive.Label className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
      {children}
    </MenuPrimitive.Label>
  );
}

export function DropdownMenuSeparator(): ReactElement {
  return <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />;
}

export function DropdownMenuSubTrigger({
  children,
  icon,
}: {
  readonly children: ReactNode;
  readonly icon?: ReactNode;
}): ReactElement {
  return (
    <MenuPrimitive.SubTrigger className={cn(itemClasses, "data-[state=open]:bg-surface-hover")}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent sideOffset={4} collisionPadding={8} className={surfaceClasses}>
        {children}
      </MenuPrimitive.SubContent>
    </MenuPrimitive.Portal>
  );
}
