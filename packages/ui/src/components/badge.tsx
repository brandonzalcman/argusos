import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Info,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import type { Tone } from "../tokens.js";

export type BadgeVariant = "subtle" | "outline" | "solid";

const subtleTone: Readonly<Record<Tone, string>> = {
  neutral: "bg-surface-sunken text-fg-muted border-border",
  accent: "bg-accent-subtle text-accent-text border-transparent",
  info: "bg-info-subtle text-info border-transparent",
  success: "bg-success-subtle text-success border-transparent",
  warning: "bg-warning-subtle text-warning border-transparent",
  high: "bg-high-subtle text-high border-transparent",
  critical: "bg-critical-subtle text-critical border-transparent",
};

const outlineTone: Readonly<Record<Tone, string>> = {
  neutral: "border-border-strong text-fg-muted",
  accent: "border-accent text-accent-text",
  info: "border-info-solid text-info",
  success: "border-success-solid text-success",
  warning: "border-warning-solid text-warning",
  high: "border-high-solid text-high",
  critical: "border-critical-solid text-critical",
};

/* Solid fills use the tone's text colour with surface text: >= 4.5:1 by construction. */
const solidTone: Readonly<Record<Tone, string>> = {
  neutral: "bg-fg-muted text-surface border-transparent",
  accent: "bg-accent text-on-accent border-transparent",
  info: "bg-info text-surface border-transparent",
  success: "bg-success text-surface border-transparent",
  warning: "bg-warning text-surface border-transparent",
  high: "bg-high text-surface border-transparent",
  critical: "bg-critical text-surface border-transparent",
};

const variantMap: Readonly<Record<BadgeVariant, Readonly<Record<Tone, string>>>> = {
  subtle: subtleTone,
  outline: outlineTone,
  solid: solidTone,
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly variant?: BadgeVariant;
  readonly size?: "sm" | "md";
  /** Optional leading icon (decorative). */
  readonly icon?: ReactNode;
}

/**
 * Compact text label for categories, counts and metadata. For operational status or severity use
 * StatusPill, which always pairs the colour with an icon and label.
 */
export function Badge({
  tone = "neutral",
  variant = "subtle",
  size = "md",
  icon,
  className,
  children,
  ...props
}: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border font-medium whitespace-nowrap",
        size === "md" ? "h-5.5 px-2 text-sm" : "h-4.5 px-1.5 text-xs",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        variantMap[variant][tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Fixed status scale used across ArgusOS. Meanings are locked so a duty officer reads the same
 * colour + icon the same way on every board.
 */
export const statusLevels = ["critical", "high", "medium", "low", "info", "ok", "stale"] as const;
export type StatusLevel = (typeof statusLevels)[number];

interface StatusDefinition {
  readonly tone: Tone;
  readonly icon: LucideIcon;
  readonly label: string;
}

export const statusDefinitions: Readonly<Record<StatusLevel, StatusDefinition>> = {
  critical: { tone: "critical", icon: OctagonAlert, label: "Critical" },
  high: { tone: "high", icon: TriangleAlert, label: "High" },
  medium: { tone: "warning", icon: CircleAlert, label: "Medium" },
  low: { tone: "info", icon: CircleDot, label: "Low" },
  info: { tone: "info", icon: Info, label: "Info" },
  ok: { tone: "success", icon: CircleCheck, label: "OK" },
  stale: { tone: "neutral", icon: CircleDashed, label: "Stale" },
};

export interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  readonly status: StatusLevel;
  /** Visible text; defaults to the status name. Tenant terminology may replace it. */
  readonly label?: string;
  readonly variant?: BadgeVariant;
  readonly size?: "sm" | "md";
  /** Gently pulse the icon to draw attention to a newly raised status. Honors reduced motion. */
  readonly attention?: boolean;
}

/** Status/severity indicator: icon + text + tone. Never colour alone. */
export function StatusPill({
  status,
  label,
  variant = "subtle",
  size = "md",
  attention = false,
  className,
  ...props
}: StatusPillProps): ReactElement {
  const definition = statusDefinitions[status];
  const Icon = definition.icon;
  return (
    <Badge
      tone={definition.tone}
      variant={variant}
      size={size}
      data-status={status}
      icon={
        <Icon
          className={cn(attention && "animate-argus-pulse motion-reduce:animate-none")}
          strokeWidth={2.25}
        />
      }
      className={cn("rounded-full", className)}
      {...props}
    >
      {label ?? definition.label}
    </Badge>
  );
}

export interface StatusDotProps {
  readonly tone: Tone;
  /** Accessible text; the dot itself is decorative. */
  readonly label: string;
  /** Show the label visibly next to the dot (default) or only to assistive tech. */
  readonly showLabel?: boolean;
  readonly pulse?: boolean;
  readonly className?: string;
}

const dotTone: Readonly<Record<Tone, string>> = {
  neutral: "bg-fg-subtle",
  accent: "bg-accent",
  info: "bg-info-solid",
  success: "bg-success-solid",
  warning: "bg-warning-solid",
  high: "bg-high-solid",
  critical: "bg-critical-solid",
};

/** Small coloured dot with a text label, for dense lists and the connection indicator. */
export function StatusDot({
  tone,
  label,
  showLabel = true,
  pulse = false,
  className,
}: StatusDotProps): ReactElement {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden="true" className="relative flex size-2">
        {pulse ? (
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping",
              dotTone[tone],
            )}
          />
        ) : null}
        <span className={cn("relative size-2 rounded-full", dotTone[tone])} />
      </span>
      <span className={cn(!showLabel && "sr-only")}>{label}</span>
    </span>
  );
}
