import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Shows an inline progress icon, sets `aria-busy` and blocks repeat activation. */
  readonly loading?: boolean;
  /** Icon rendered before the label (decorative; the label names the action). */
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  /** Render the single child (e.g. a router Link) with button styling. */
  readonly asChild?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

const variantClasses: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-transparent bg-accent text-on-accent shadow-sm hover:bg-accent-hover",
  secondary:
    "border-border bg-surface text-fg shadow-sm hover:border-border-strong hover:bg-surface-hover",
  ghost: "border-transparent bg-transparent text-fg hover:bg-surface-hover",
  danger: "border-transparent bg-critical text-surface shadow-sm hover:opacity-90",
  link: "h-auto! border-transparent bg-transparent px-0! text-accent-text underline-offset-4 hover:underline",
};

const sizeClasses: Readonly<Record<ButtonSize, string>> = {
  sm: "h-(--argus-control-h-sm) gap-1.5 px-2.5 text-sm [&_svg]:size-3.5",
  md: "h-(--argus-control-h) gap-2 px-(--argus-control-px) text-base [&_svg]:size-4",
  lg: "h-(--argus-control-h-lg) gap-2 px-4 text-md [&_svg]:size-4.5",
};

/** Class list shared by Button and elements that need button styling (e.g. router links). */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm border font-medium",
    "transition-colors duration-(--argus-duration-fast) ease-out",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:shrink-0",
    focusRing,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

/**
 * Text button for every action. Use `primary` once per view for the main action, `danger` only
 * for destructive actions (always confirmed), `ghost` in toolbars and `link` inline in prose.
 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  asChild = false,
  className,
  children,
  type,
  ref,
  onClick,
  ...props
}: ButtonProps): ReactElement {
  const classes = buttonClasses(variant, size, className);
  if (asChild) {
    return (
      <Slot.Root className={classes} ref={ref} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        leadingIcon
      )}
      {children}
      {trailingIcon}
    </button>
  );
}
