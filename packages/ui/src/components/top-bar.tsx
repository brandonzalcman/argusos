import { Clock, Gauge, Menu, Search, Siren, UserRound } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";
import { useAppShell } from "./app-shell.js";
import { type StatusLevel, StatusPill } from "./badge.js";
import { IconButton } from "./icon-button.js";
import { Kbd } from "./kbd.js";

export const NOT_SELECTED = "Not selected";

export interface IncidentLevel {
  /** Tenant terminology, e.g. "Level 2" or "Major". */
  readonly label: string;
  /** Severity mapping used for colour + icon. */
  readonly status: StatusLevel;
}

export interface TopBarProps {
  /** Active incident display label; null/undefined renders "Not selected". */
  readonly activeIncidentLabel?: string | null;
  readonly incidentLevel?: IncidentLevel | null;
  readonly operationalPeriodLabel?: string | null;
  /** The signed-in user's current position (ICS role). */
  readonly positionLabel?: string | null;
  /** Usually `<ConnectionIndicator variant="pill" />`. */
  readonly connection: ReactNode;
  /** Right-side controls (alerts, density, theme, user menu). */
  readonly actions?: ReactNode;
  /** Opens the command palette; renders the search trigger when provided. */
  readonly onOpenCommandPalette?: () => void;
  /** Shortcut hint for the search trigger. Defaults to Ctrl K. */
  readonly commandShortcut?: readonly string[];
}

interface ContextPillProps {
  readonly label: string;
  readonly value: string | null | undefined;
  readonly icon: ReactNode;
  readonly renderValue?: (() => ReactNode) | undefined;
  readonly className?: string;
  readonly mono?: boolean;
}

/** One labelled context value; unknown values read "Not selected" in a muted style. */
function ContextPill({
  label,
  value,
  icon,
  renderValue,
  className,
  mono = false,
}: ContextPillProps): ReactElement {
  const missing = value === null || value === undefined || value.trim() === "";
  return (
    <div
      title={`${label}: ${missing ? NOT_SELECTED : value}`}
      className={cn(
        "flex h-full min-w-0 items-center gap-2 px-3 whitespace-nowrap first:ps-2.5 last:pe-2.5",
        missing && "shrink-0",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "lg:hidden 2xl:inline [&_svg]:size-3.5",
          missing ? "text-fg-subtle" : "text-accent-text",
        )}
      >
        {icon}
      </span>
      <dt className="sr-only text-xs font-medium whitespace-nowrap text-fg-muted lg:not-sr-only">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 min-w-0 truncate text-sm",
          missing ? "text-fg-subtle" : "font-semibold text-fg",
          mono && !missing && "font-mono text-[0.8125rem]",
        )}
      >
        {missing ? NOT_SELECTED : renderValue ? renderValue() : value}
      </dd>
    </div>
  );
}

/**
 * Persistent status bar: active incident + level, operational period, your position, connection
 * state, command search and global actions. Labels must already be authorized for the viewer.
 */
export function TopBar({
  activeIncidentLabel,
  incidentLevel,
  operationalPeriodLabel,
  positionLabel,
  connection,
  actions,
  onOpenCommandPalette,
  commandShortcut = ["Ctrl", "K"],
}: TopBarProps): ReactElement {
  const { setMobileOpen } = useAppShell();
  return (
    <header className="sticky top-0 z-(--argus-z-topbar) flex h-(--argus-topbar-h) shrink-0 items-center gap-3 border-b border-border bg-surface px-3 lg:px-4">
      <IconButton
        label="Open navigation"
        icon={<Menu />}
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
      />
      <section aria-label="Current operations context" className="min-w-0 flex-1">
        <dl className="m-0 flex h-8 w-fit max-w-full min-w-0 items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-surface-sunken/70 rtl:divide-x-reverse">
          <ContextPill
            label="Incident"
            value={activeIncidentLabel}
            icon={<Siren />}
            className="max-w-[20rem] shrink"
          />
          <ContextPill
            label="Level"
            value={incidentLevel?.label}
            icon={<Gauge />}
            className="hidden shrink-0 xl:flex"
            renderValue={
              incidentLevel
                ? () => (
                    <StatusPill
                      status={incidentLevel.status}
                      label={incidentLevel.label}
                      size="sm"
                    />
                  )
                : undefined
            }
          />
          <ContextPill
            label="Period"
            value={operationalPeriodLabel}
            icon={<Clock />}
            mono
            className="hidden max-w-[14rem] shrink md:flex"
          />
          <ContextPill
            label="Position"
            value={positionLabel}
            icon={<UserRound />}
            className="hidden max-w-[14rem] shrink sm:flex"
          />
        </dl>
      </section>
      <div className="flex shrink-0 items-center gap-1.5">
        {onOpenCommandPalette ? (
          <>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className={cn(
                "hidden h-8 w-60 items-center gap-2 rounded-md border border-border bg-surface-sunken px-2.5 text-sm whitespace-nowrap text-fg-muted 2xl:flex",
                "transition-colors hover:border-border-strong hover:text-fg",
                focusRing,
              )}
            >
              <Search aria-hidden="true" className="size-4" />
              <span className="flex-1 text-start">Search or jump to…</span>
              <span className="flex gap-0.5" aria-hidden="true">
                {commandShortcut.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
              <span className="sr-only">(shortcut {commandShortcut.join("+")})</span>
            </button>
            <IconButton
              label="Search or jump to"
              shortcut={commandShortcut}
              icon={<Search />}
              className="2xl:hidden"
              onClick={onOpenCommandPalette}
            />
          </>
        ) : null}
        {connection}
        {actions ? (
          <>
            <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {actions}
          </>
        ) : null}
      </div>
    </header>
  );
}
