/**
 * Session-local label cache for ids picked in lookup editors (user, position, link-to-record).
 * Only labels the caller was already authorized to search are stored here.
 * TODO(implementation): batched label resolution through the data port so labels of ids not picked in
 * this session (e.g. rows created by others) render by name instead of a short id.
 */
const labels = new Map<string, string>();

export function rememberLookupLabel(id: string, label: string): void {
  labels.set(id, label);
}

export function lookupLabel(id: string): string {
  return labels.get(id) ?? `#${id.slice(0, 8)}`;
}
