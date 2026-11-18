import { CloudOff, Radio, RefreshCw, Timer } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import type { Tone } from "../tokens.js";
import { Tooltip } from "./tooltip.js";

export type ConnectionState = "live" | "reconnecting" | "offline" | "polling";

export interface ConnectionIndicatorProps {
  readonly state: ConnectionState;
  /** ISO timestamp of the last received update. Never invented when unknown. */
  readonly lastUpdatedAt?: string;
  /** Extra explanation, e.g. "Sync has not been connected". */
  readonly stateDetail?: string;
  /** `pill` for the top bar, `full` for panels and settings. */
  readonly variant?: "pill" | "full";
}

const stateMeta: Readonly<Record<ConnectionState, { label: string; tone: Tone; icon: ReactNode }>> =
  {
    live: { label: "Live", tone: "success", icon: <Radio /> },
    reconnecting: { label: "Reconnecting", tone: "warning", icon: <RefreshCw /> },
    offline: { label: "Offline", tone: "critical", icon: <CloudOff /> },
    polling: { label: "Polling fallback", tone: "info", icon: <Timer /> },
  };

const toneClasses: Readonly<Partial<Record<Tone, string>>> = {
  success: "text-success bg-success-subtle",
  warning: "text-warning bg-warning-subtle",
  critical: "text-critical bg-critical-subtle",
  info: "text-info bg-info-subtle",
};

/**
 * Freshness of live data. Always visible so operators know whether a screen is live,
 * reconnecting or offline. Changes are announced politely.
 */
export function ConnectionIndicator({
  state,
  lastUpdatedAt,
  stateDetail,
  variant = "full",
}: ConnectionIndicatorProps): ReactElement {
  const meta = stateMeta[state];
  const updated = lastUpdatedAt ? (
    <>
      Last update <time dateTime={lastUpdatedAt}>{lastUpdatedAt}</time>
    </>
  ) : (
    "Last update unavailable"
  );

  if (variant === "pill") {
    const pill = (
      <span
        role="status"
        aria-live="polite"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can read the detail tooltip
        tabIndex={0}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          toneClasses[meta.tone],
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "[&_svg]:size-3.5",
            state === "reconnecting" && "[&_svg]:motion-safe:animate-spin",
          )}
        >
          {meta.icon}
        </span>
        {meta.label}
        <span className="sr-only">
          {stateDetail ? `. ${stateDetail}` : ""}.{" "}
          {lastUpdatedAt ? `Last update ${lastUpdatedAt}` : "Last update unavailable"}
        </span>
      </span>
    );
    return (
      <Tooltip
        content={
          <span className="grid gap-0.5">
            {stateDetail ? <span>{stateDetail}</span> : null}
            <span className="opacity-80">{updated}</span>
          </span>
        }
      >
        {pill}
      </Tooltip>
    );
  }

  return (
    <section
      aria-label="Data connection"
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-border bg-surface p-3"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
          toneClasses[meta.tone],
        )}
      >
        {meta.icon}
      </span>
      <div className="grid gap-0.5">
        <strong className="text-base font-semibold text-fg">{meta.label}</strong>
        {stateDetail ? <span className="text-sm text-fg-muted">{stateDetail}</span> : null}
        <span className="text-sm text-fg-muted">{updated}</span>
      </div>
    </section>
  );
}
