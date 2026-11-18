import type { SandboxFrameEvent } from "@argus/sdk/host";

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleEntry {
  readonly id: number;
  readonly level: ConsoleLevel;
  readonly text: string;
  /** Where the entry came from, for the label next to the icon. */
  readonly origin: "console" | "runtime" | "preview";
  readonly line: number | null;
  readonly column: number | null;
}

export const MAX_CONSOLE_ENTRIES = 200;

/** Message shown when the preview's record services are called without a connected data port. */
export const PREVIEW_DATA_NOT_CONNECTED = "Data isn't connected in the preview yet.";

/** Maps a sandbox frame event to a console entry; resize events carry no message. */
export function frameEventToEntry(event: SandboxFrameEvent, id: number): ConsoleEntry | null {
  switch (event.type) {
    case "ready":
      return {
        id,
        level: "info",
        origin: "runtime",
        text: "Preview ready.",
        line: null,
        column: null,
      };
    case "error":
      return {
        id,
        level: "error",
        origin: "runtime",
        text: `${event.phase[0]?.toUpperCase() ?? ""}${event.phase.slice(1)} error: ${event.message}`,
        line: event.line,
        column: event.column,
      };
    case "console":
      return {
        id,
        level: event.level,
        origin: "console",
        text: event.args.join(" "),
        line: null,
        column: null,
      };
    case "stalled":
      return {
        id,
        level: "error",
        origin: "runtime",
        text: "The preview stopped responding and was stopped (possible infinite loop).",
        line: null,
        column: null,
      };
    case "navigated":
      return {
        id,
        level: "error",
        origin: "runtime",
        text: "The component tried to navigate away and was stopped.",
        line: null,
        column: null,
      };
    case "resize":
      return null;
  }
}

/** Appends an entry, keeping only the newest `max`. */
export function appendEntry(
  entries: readonly ConsoleEntry[],
  entry: ConsoleEntry,
  max: number = MAX_CONSOLE_ENTRIES,
): ConsoleEntry[] {
  const next = [...entries, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}
