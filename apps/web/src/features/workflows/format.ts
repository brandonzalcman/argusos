/** Formats an ISO timestamp with timezone and relative age, e.g. "14:32 UTC · 3 min ago". */
export function formatTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "invalid time";
  }
  const clock = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
    timeZoneName: "short",
  }).format(date);
  return `${clock} · ${relativeAge(date, now)}`;
}

/** Relative age such as "3 min ago" or "in 2 h". */
export function relativeAge(date: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const abs = Math.abs(seconds);
  let text: string;
  if (abs < 60) text = `${abs} s`;
  else if (abs < 3600) text = `${Math.floor(abs / 60)} min`;
  else if (abs < 86_400) text = `${Math.floor(abs / 3600)} h`;
  else text = `${Math.floor(abs / 86_400)} d`;
  return seconds >= 0 ? `${text} ago` : `in ${text}`;
}

/** Duration between two ISO timestamps, or null while still running. */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (endIso === null) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms)) return null;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}
