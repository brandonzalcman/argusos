/**
 * Formats an ISO timestamp as "14:32 UTC · 3 min ago" per the UI rule: zone and relative age.
 * Input: ISO-8601 string, current time and an optional IANA zone (defaults to the viewer's).
 * Output: display text; returns the raw input when it is not a valid date.
 * Errors: none.
 * Depends on: Intl.DateTimeFormat.
 */
export function formatTimestamp(iso: string, now: Date, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(date);
  return `${clock} · ${relativeAge(date, now)}`;
}

export function relativeAge(date: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "in the future";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
