import type { LayoutItem, MenuItem } from "@argus/schema";

/** Menu item annotated with whether the previewed position can see it (and why not). */
export interface PreviewedMenuItem {
  readonly item: MenuItem;
  readonly visible: boolean;
  readonly children: readonly PreviewedMenuItem[];
}

/**
 * Applies the definition-level position filter (UX only; target authorization is server-side).
 * Empty positionIds means visible to every position. A hidden parent hides its subtree.
 * visibilityExpression (CEL) is NOT evaluated here — only the server can do that.
 */
export function previewMenuForPosition(
  items: readonly MenuItem[],
  positionId: string,
  denied: ReadonlySet<string> = new Set(),
): PreviewedMenuItem[] {
  return items.map((item) => {
    const allowedByPosition =
      item.positionIds.length === 0 || item.positionIds.includes(positionId);
    const allowed = allowedByPosition && !denied.has(item.id);
    return {
      item,
      visible: allowed,
      children: previewMenuForPosition(
        item.children,
        positionId,
        allowed ? denied : new Set(collectIds(item.children)),
      ),
    };
  });
}

function collectIds(items: readonly MenuItem[]): string[] {
  return items.flatMap((item) => [item.id, ...collectIds(item.children)]);
}

/** Moves a sibling up (-1) or down (+1) anywhere in the tree; returns the same array if impossible. */
export function moveMenuItem(items: readonly MenuItem[], id: string, delta: -1 | 1): MenuItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return [...items];
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved as MenuItem);
    return next;
  }
  return items.map((item) => ({ ...item, children: moveMenuItem(item.children, id, delta) }));
}

/** Replaces one item anywhere in the tree. */
export function updateMenuItem(
  items: readonly MenuItem[],
  id: string,
  patch: Partial<MenuItem>,
): MenuItem[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, ...patch }
      : { ...item, children: updateMenuItem(item.children, id, patch) },
  );
}

/** Removes one item (and its subtree) anywhere in the tree. */
export function removeMenuItem(items: readonly MenuItem[], id: string): MenuItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: removeMenuItem(item.children, id) }));
}

/** Flattens a menu tree depth-first with depth, for keyboard-friendly list rendering. */
export function flattenMenu(
  items: readonly MenuItem[],
  depth = 0,
): { readonly item: MenuItem; readonly depth: number }[] {
  return items.flatMap((item) => [{ item, depth }, ...flattenMenu(item.children, depth + 1)]);
}

/** Only http(s) and mailto links may be previewed as navigable; others are shown as text. */
export function isSafeMenuUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Sorts layout items for a stable reading and tab order (row, then column). */
export function sortLayoutItems(items: readonly LayoutItem[]): LayoutItem[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Returns the pairs of visible blocks whose rectangles overlap in the 12-column grid. */
export function findLayoutOverlaps(items: readonly LayoutItem[]): readonly [string, string][] {
  const visible = items.filter((item) => !item.hidden);
  const overlaps: [string, string][] = [];
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i] as LayoutItem;
      const b = visible[j] as LayoutItem;
      if (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      ) {
        overlaps.push([a.blockId, b.blockId]);
      }
    }
  }
  return overlaps;
}

/** Parses #rgb / #rrggbb into 0–255 channels, or null when not a hex colour. */
export function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1] as string;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2.x contrast ratio between two hex colours, or null if either is not parseable. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return null;
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastCheck {
  readonly label: string;
  readonly foregroundKey: string;
  readonly backgroundKey: string;
  readonly minimum: number;
  readonly ratio: number | null;
  readonly pass: boolean;
}

/**
 * Checks AA contrast for the role pairs the design system relies on (text 4.5:1, accent/border 3:1).
 * Pairs whose keys are absent or non-hex are reported with ratio null and pass=false.
 */
export function checkThemeContrast(colors: Readonly<Record<string, string>>): ContrastCheck[] {
  const pairs: readonly [string, string, string, number][] = [
    ["Text on surface", "text", "surface", 4.5],
    ["Muted text on surface", "text-muted", "surface", 4.5],
    ["Accent on surface", "accent", "surface", 3],
    ["Border on surface", "border", "surface", 3],
  ];
  return pairs.map(([label, foregroundKey, backgroundKey, minimum]) => {
    const fg = colors[foregroundKey];
    const bg = colors[backgroundKey];
    const ratio = fg !== undefined && bg !== undefined ? contrastRatio(fg, bg) : null;
    return {
      label,
      foregroundKey,
      backgroundKey,
      minimum,
      ratio,
      pass: ratio !== null && ratio >= minimum,
    };
  });
}
