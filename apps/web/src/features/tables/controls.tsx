import {
  buttonClasses,
  cn,
  controlClasses,
  type Density,
  type ToastApi,
  useToast,
  useUIPreferences,
} from "@argus/ui";
import type { ComponentProps, ReactElement } from "react";

/** Native control chrome built from @argus/ui tokens (same look as Input/Textarea). */
export const nativeControl = cn(controlClasses, "h-(--argus-control-h) px-(--argus-control-px)");
export const nativeTextarea = cn(controlClasses, "min-h-16 px-(--argus-control-px) py-2");
export const nativeMono = "font-mono text-sm";
export const btn = buttonClasses("secondary", "sm");
export const btnPrimary = buttonClasses("primary", "sm");
export const btnGhost = buttonClasses("ghost", "sm");

/**
 * Native <select> with @argus/ui control chrome. Used instead of the Radix Select where an empty
 * "none" value is meaningful and the list is long (field types, operators, options).
 */
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">): ReactElement {
  return <select {...props} className={cn(nativeControl, "pe-8", className)} />;
}

/** Density without requiring the preferences provider (tests, Storybook). */
export function useRowDensity(): Density {
  try {
    // biome-ignore lint/correctness/useHookAtTopLevel: guarded context read that only throws without a provider.
    return useUIPreferences().density;
  } catch {
    return "comfortable";
  }
}

/** Toasts without requiring the provider; returns undefined where none is mounted. */
export function useOptionalToast(): ToastApi | undefined {
  try {
    // biome-ignore lint/correctness/useHookAtTopLevel: guarded context read that only throws without a provider.
    return useToast();
  } catch {
    return undefined;
  }
}
