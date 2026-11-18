/**
 * Command palette model. `CommandPaletteItem` is structurally compatible with apps/web's
 * `CommandDescriptor` (services/command-palette.ts) so port results can be passed straight in.
 */
export type CommandKind = "navigation" | "record" | "incident" | "position" | "action";

export interface CommandPaletteItem {
  readonly id: string;
  readonly title: string;
  readonly kind: CommandKind;
  readonly targetId: string;
  /** Secondary line, e.g. a record's table name. Must already be authorized for display. */
  readonly subtitle?: string;
  /** Display-only shortcut hint, e.g. ["G", "I"]. */
  readonly shortcut?: readonly string[];
  /** Extra terms that should match (aliases). */
  readonly keywords?: readonly string[];
}

/** One federated search provider (navigation, records, incidents ...). */
export interface CommandPaletteSource {
  readonly id: string;
  /** Group heading shown above this source's results. */
  readonly label: string;
  readonly search: (query: string, signal: AbortSignal) => Promise<readonly CommandPaletteItem[]>;
}

export type SourceResult =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly items: readonly CommandPaletteItem[] }
  | { readonly status: "error"; readonly message: string };

/**
 * Scores how well `item` matches `query` (0 = no match). Prefix > word-prefix > substring >
 * in-order subsequence; title beats keywords/subtitle. Case- and accent-insensitive.
 */
export function scoreCommand(item: CommandPaletteItem, query: string): number {
  const q = normalize(query);
  if (q.length === 0) {
    return 1;
  }
  const title = normalize(item.title);
  const extra = normalize([item.subtitle ?? "", ...(item.keywords ?? [])].join(" "));
  if (title.startsWith(q)) {
    return 100 - Math.min(title.length - q.length, 50) / 10;
  }
  if (title.split(/[\s/_-]+/).some((word) => word.startsWith(q))) {
    return 80;
  }
  if (title.includes(q)) {
    return 60;
  }
  if (extra.includes(q)) {
    return 40;
  }
  if (isSubsequence(q, title)) {
    return 20;
  }
  return 0;
}

/** Filters and orders items locally (for static sources such as navigation). */
export function filterCommands(
  items: readonly CommandPaletteItem[],
  query: string,
  limit = 20,
): readonly CommandPaletteItem[] {
  return items
    .map((item, index) => ({ item, index, score: scoreCommand(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Flattens ready source results into keyboard order, skipping loading/error sources. */
export function flattenResults(
  sources: readonly CommandPaletteSource[],
  results: Readonly<Record<string, SourceResult>>,
): readonly CommandPaletteItem[] {
  return sources.flatMap((source) => {
    const result = results[source.id];
    return result?.status === "ready" ? result.items : [];
  });
}

/** Moves the active index with wrap-around; returns -1 when there are no items. */
export function moveActiveIndex(current: number, delta: number, count: number): number {
  if (count <= 0) {
    return -1;
  }
  if (current < 0) {
    return delta >= 0 ? 0 : count - 1;
  }
  return (((current + delta) % count) + count) % count;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isSubsequence(needle: string, haystack: string): boolean {
  let position = 0;
  for (const char of haystack) {
    if (char === needle[position]) {
      position += 1;
      if (position === needle.length) {
        return true;
      }
    }
  }
  return needle.length === 0;
}
