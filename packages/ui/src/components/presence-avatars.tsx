import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { Tooltip } from "./tooltip.js";

export interface PresencePerson {
  readonly id: string;
  readonly displayName: string;
  readonly positionLabel?: string;
}

export interface PresenceAvatarsProps {
  readonly people: readonly PresencePerson[];
  readonly maxVisible?: number;
  readonly label?: string;
  readonly className?: string;
}

/** Initials from a display name ("Alex Chen" -> "AC"); falls back to "?". */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Overlapping initials for people viewing the same record or board, with names in tooltips and
 * in the accessible list. Renders already-authorized presence only; never opens a connection.
 */
export function PresenceAvatars({
  people,
  maxVisible = 4,
  label = "People currently viewing",
  className,
}: PresenceAvatarsProps): ReactElement {
  const visible = people.slice(0, Math.max(0, maxVisible));
  const overflow = Math.max(0, people.length - visible.length);
  if (people.length === 0) {
    return <span className={cn("text-sm text-fg-muted", className)}>No one else viewing</span>;
  }
  return (
    <ul
      aria-label={label}
      className={cn("flex items-center -space-x-1.5 rtl:space-x-reverse", className)}
    >
      {visible.map((person) => {
        const name = person.positionLabel
          ? `${person.displayName} (${person.positionLabel})`
          : person.displayName;
        return (
          <li key={person.id}>
            <Tooltip content={name}>
              <span
                // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so the tooltip is keyboard reachable
                tabIndex={0}
                className="flex size-7 items-center justify-center rounded-full border-2 border-surface bg-accent-subtle text-xs font-semibold text-accent-text outline-none focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span aria-hidden="true">{initialsFor(person.displayName)}</span>
                <span className="sr-only">{name}</span>
              </span>
            </Tooltip>
          </li>
        );
      })}
      {overflow > 0 ? (
        <li className="flex size-7 items-center justify-center rounded-full border-2 border-surface bg-surface-sunken text-xs font-semibold text-fg-muted">
          <span aria-hidden="true">+{overflow}</span>
          <span className="sr-only">and {overflow} more</span>
        </li>
      ) : null}
    </ul>
  );
}
