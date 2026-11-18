import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { focusRingInset } from "../lib/focus.js";
import { controlClasses, useControlAttributes } from "./field.js";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectOptionGroup {
  readonly label: string;
  readonly options: readonly SelectOption[];
}

export interface SelectProps {
  readonly options: readonly (SelectOption | SelectOptionGroup)[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Shown when nothing is selected. */
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  /** Form field name for native form submission. */
  readonly name?: string;
  readonly id?: string;
  /** Accessible name when not inside a Field. */
  readonly "aria-label"?: string;
  readonly className?: string;
  readonly size?: "sm" | "md";
}

function isGroup(option: SelectOption | SelectOptionGroup): option is SelectOptionGroup {
  return "options" in option;
}

function SelectItem({ option }: { readonly option: SelectOption }): ReactElement {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled ?? false}
      className={cn(
        "relative flex h-(--argus-control-h) cursor-default select-none items-center rounded-sm ps-8 pe-3 text-base text-fg outline-none",
        "data-highlighted:bg-surface-hover data-disabled:text-fg-subtle data-disabled:opacity-60",
        focusRingInset,
      )}
    >
      <SelectPrimitive.ItemIndicator className="absolute start-2.5 inline-flex items-center">
        <Check aria-hidden="true" className="size-4 text-accent-text" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/**
 * Single-choice dropdown (Radix Select): full keyboard support, typeahead, and a native hidden
 * select for forms. For more than ~15 options or free text, use a combobox instead.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  disabled,
  required,
  invalid,
  name,
  id,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: SelectProps): ReactElement {
  const attributes = useControlAttributes({ id, invalid, required, disabled });
  const rootProps = {
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(onValueChange ? { onValueChange } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(attributes.disabled !== undefined ? { disabled: attributes.disabled } : {}),
    ...(attributes.required !== undefined ? { required: attributes.required } : {}),
  };
  return (
    <SelectPrimitive.Root {...rootProps}>
      <SelectPrimitive.Trigger
        id={attributes.id}
        aria-label={ariaLabel}
        aria-describedby={attributes["aria-describedby"]}
        aria-invalid={attributes["aria-invalid"]}
        className={cn(
          controlClasses,
          "flex items-center justify-between gap-2 text-start",
          size === "md"
            ? "h-(--argus-control-h) px-(--argus-control-px)"
            : "h-(--argus-control-h-sm) px-2 text-sm",
          "data-placeholder:text-fg-subtle",
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "z-(--argus-z-popover) max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden",
            "rounded-md border border-border bg-surface-raised shadow-md",
            "data-[state=open]:animate-argus-pop-in",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) =>
              isGroup(option) ? (
                <SelectPrimitive.Group key={option.label}>
                  <SelectPrimitive.Label className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                    {option.label}
                  </SelectPrimitive.Label>
                  {option.options.map((item) => (
                    <SelectItem key={item.value} option={item} />
                  ))}
                </SelectPrimitive.Group>
              ) : (
                <SelectItem key={option.value} option={option} />
              ),
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
