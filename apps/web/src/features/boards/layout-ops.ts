import type { BlockKind, LayoutBreakpoint, LayoutDefinition, LayoutItem } from "./model.js";

export const GRID_COLUMNS = 12;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface BlockSize {
  readonly w: number;
  readonly h: number;
  readonly minW: number;
  readonly minH: number;
}

/** Default and minimum footprint per block kind on the 12-column grid. */
export const blockSizes: Readonly<Record<BlockKind, BlockSize>> = {
  "field-input": { w: 4, h: 2, minW: 2, minH: 1 },
  "field-display": { w: 4, h: 1, minW: 2, minH: 1 },
  "record-list": { w: 12, h: 6, minW: 4, minH: 3 },
  "related-records": { w: 6, h: 4, minW: 3, minH: 2 },
  stat: { w: 3, h: 2, minW: 2, minH: 2 },
  chart: { w: 6, h: 4, minW: 3, minH: 3 },
  map: { w: 8, h: 6, minW: 4, minH: 4 },
  timeline: { w: 12, h: 4, minW: 6, minH: 3 },
  "rich-text": { w: 6, h: 3, minW: 2, minH: 1 },
  image: { w: 4, h: 3, minW: 2, minH: 2 },
  button: { w: 3, h: 1, minW: 2, minH: 1 },
  tabs: { w: 12, h: 6, minW: 4, minH: 3 },
  section: { w: 12, h: 4, minW: 4, minH: 2 },
  divider: { w: 12, h: 1, minW: 1, minH: 1 },
  embed: { w: 6, h: 4, minW: 3, minH: 3 },
  comments: { w: 4, h: 5, minW: 3, minH: 3 },
  checklist: { w: 4, h: 4, minW: 3, minH: 2 },
  "attachment-gallery": { w: 6, h: 3, minW: 3, minH: 2 },
  countdown: { w: 3, h: 2, minW: 2, minH: 1 },
  weather: { w: 3, h: 2, minW: 2, minH: 2 },
  "board-embed": { w: 12, h: 8, minW: 4, minH: 4 },
  "link-list": { w: 4, h: 3, minW: 2, minH: 2 },
  "custom-component": { w: 6, h: 4, minW: 1, minH: 1 },
};

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function clampRect(rect: Rect, min: { readonly minW: number; readonly minH: number }): Rect {
  const width = Math.min(GRID_COLUMNS, Math.max(min.minW, Math.round(rect.width)));
  const height = Math.max(min.minH, Math.round(rect.height));
  const x = Math.min(GRID_COLUMNS - width, Math.max(0, Math.round(rect.x)));
  const y = Math.max(0, Math.round(rect.y));
  return { x, y, width, height };
}

/**
 * Resolves collisions by pushing later items down, keeping `anchorId` where it was placed.
 * Hidden items never occupy space. Deterministic: ordered by (y, x, blockId).
 */
export function resolveCollisions(
  items: readonly LayoutItem[],
  anchorId: string | null,
): readonly LayoutItem[] {
  const anchor = anchorId === null ? undefined : items.find((item) => item.blockId === anchorId);
  const others = items
    .filter((item) => item.blockId !== anchorId)
    .toSorted((a, b) => a.y - b.y || a.x - b.x || a.blockId.localeCompare(b.blockId));
  const placed: LayoutItem[] = anchor && !anchor.hidden ? [anchor] : [];
  const out = new Map<string, LayoutItem>();
  if (anchor) {
    out.set(anchor.blockId, anchor);
  }
  for (const item of others) {
    if (item.hidden) {
      out.set(item.blockId, item);
      continue;
    }
    let next = item;
    let collider = placed.find((p) => overlaps(p, next));
    while (collider) {
      next = { ...next, y: collider.y + collider.height };
      collider = placed.find((p) => overlaps(p, next));
    }
    placed.push(next);
    out.set(item.blockId, next);
  }
  return items.map((item) => out.get(item.blockId) ?? item);
}

export type KindLookup = (blockId: string) => BlockKind | undefined;

function minFor(kind: BlockKind | undefined): { minW: number; minH: number } {
  return kind ? blockSizes[kind] : { minW: 1, minH: 1 };
}

/** Moves/resizes one block to `next`, clamped to the grid, then pushes colliders down. */
export function placeItem(
  items: readonly LayoutItem[],
  blockId: string,
  next: Rect,
  kindOf: KindLookup,
): readonly LayoutItem[] {
  if (!items.some((item) => item.blockId === blockId)) {
    return items;
  }
  const rect = clampRect(next, minFor(kindOf(blockId)));
  const moved = items.map((item) => (item.blockId === blockId ? { ...item, ...rect } : item));
  return resolveCollisions(moved, blockId);
}

export function nudgeItem(
  items: readonly LayoutItem[],
  blockId: string,
  delta: { dx?: number; dy?: number; dw?: number; dh?: number },
  kindOf: KindLookup,
): readonly LayoutItem[] {
  const current = items.find((item) => item.blockId === blockId);
  if (!current) {
    return items;
  }
  return placeItem(
    items,
    blockId,
    {
      x: current.x + (delta.dx ?? 0),
      y: current.y + (delta.dy ?? 0),
      width: current.width + (delta.dw ?? 0),
      height: current.height + (delta.dh ?? 0),
    },
    kindOf,
  );
}

export function bottomOf(items: readonly LayoutItem[]): number {
  return items.reduce((max, item) => (item.hidden ? max : Math.max(max, item.y + item.height)), 0);
}

export function newItemFor(
  items: readonly LayoutItem[],
  blockId: string,
  kind: BlockKind,
): LayoutItem {
  const size = blockSizes[kind];
  return { blockId, x: 0, y: bottomOf(items), width: size.w, height: size.h, hidden: false };
}

export function layoutFor(
  layout: LayoutDefinition,
  breakpoint: LayoutBreakpoint,
): readonly LayoutItem[] {
  return layout.layouts.find((l) => l.breakpoint === breakpoint)?.items ?? [];
}

/** Replaces the items of one breakpoint, creating the breakpoint entry when missing. */
export function withBreakpointItems(
  layout: LayoutDefinition,
  breakpoint: LayoutBreakpoint,
  items: readonly LayoutItem[],
): LayoutDefinition {
  const exists = layout.layouts.some((l) => l.breakpoint === breakpoint);
  const layouts = exists
    ? layout.layouts.map((l) => (l.breakpoint === breakpoint ? { ...l, items: [...items] } : l))
    : [...layout.layouts, { breakpoint, items: [...items] }];
  return { ...layout, layouts };
}

export interface LayoutProblem {
  readonly code: "out-of-bounds" | "collision" | "duplicate-block" | "unknown-block";
  readonly blockId: string;
  readonly message: string;
}

export function validateItems(
  items: readonly LayoutItem[],
  knownBlockIds: ReadonlySet<string>,
): readonly LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.blockId)) {
      problems.push({ code: "duplicate-block", blockId: item.blockId, message: "Placed twice." });
    }
    seen.add(item.blockId);
    if (!knownBlockIds.has(item.blockId)) {
      problems.push({ code: "unknown-block", blockId: item.blockId, message: "Unknown block." });
    }
    if (item.x < 0 || item.x + item.width > GRID_COLUMNS) {
      problems.push({
        code: "out-of-bounds",
        blockId: item.blockId,
        message: "Exceeds the 12-column grid.",
      });
    }
  }
  const visible = items.filter((item) => !item.hidden);
  visible.forEach((a, i) => {
    for (const b of visible.slice(i + 1)) {
      if (overlaps(a, b)) {
        problems.push({
          code: "collision",
          blockId: a.blockId,
          message: `Overlaps block ${b.blockId}.`,
        });
      }
    }
  });
  return problems;
}

const breakpointMinWidth: Readonly<Record<LayoutBreakpoint, number>> = {
  phone: 0,
  tablet: 768,
  desktop: 1280,
  "video-wall": 2560,
};

export function breakpointForWidth(widthPx: number): LayoutBreakpoint {
  if (widthPx >= breakpointMinWidth["video-wall"]) return "video-wall";
  if (widthPx >= breakpointMinWidth.desktop) return "desktop";
  if (widthPx >= breakpointMinWidth.tablet) return "tablet";
  return "phone";
}

const fallbackOrder: Readonly<Record<LayoutBreakpoint, readonly LayoutBreakpoint[]>> = {
  phone: ["phone", "tablet", "desktop"],
  tablet: ["tablet", "desktop"],
  desktop: ["desktop", "tablet"],
  "video-wall": ["video-wall", "desktop", "tablet"],
};

/** Falls back toward desktop when a breakpoint has no authored layout. */
export function resolveBreakpointItems(
  layout: LayoutDefinition,
  breakpoint: LayoutBreakpoint,
): { readonly breakpoint: LayoutBreakpoint; readonly items: readonly LayoutItem[] } {
  for (const candidate of fallbackOrder[breakpoint]) {
    const found = layout.layouts.find((l) => l.breakpoint === candidate);
    if (found) {
      return { breakpoint: candidate, items: found.items };
    }
  }
  return { breakpoint, items: [] };
}

/** Phone reading order: top-to-bottom, left-to-right; each block uses the full width. */
export function stackItems(items: readonly LayoutItem[]): readonly LayoutItem[] {
  return items
    .filter((item) => !item.hidden)
    .toSorted((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => ({ ...item, x: 0, width: GRID_COLUMNS }));
}

/**
 * Moves several blocks together by (dx, dy), clamped so the whole group stays on the grid, then
 * pushes every non-selected block down out of the way. Resizing is single-block only.
 */
export function moveGroup(
  items: readonly LayoutItem[],
  blockIds: ReadonlySet<string>,
  dx: number,
  dy: number,
): readonly LayoutItem[] {
  const group = items.filter((item) => blockIds.has(item.blockId));
  if (group.length === 0) {
    return items;
  }
  const minX = Math.min(...group.map((i) => i.x));
  const maxX = Math.max(...group.map((i) => i.x + i.width));
  const minY = Math.min(...group.map((i) => i.y));
  const cdx = Math.min(GRID_COLUMNS - maxX, Math.max(-minX, Math.round(dx)));
  const cdy = Math.max(-minY, Math.round(dy));
  const moved = items.map((item) =>
    blockIds.has(item.blockId) ? { ...item, x: item.x + cdx, y: item.y + cdy } : item,
  );
  const anchors = moved.filter((item) => blockIds.has(item.blockId) && !item.hidden);
  const placed: LayoutItem[] = [...anchors];
  const out = new Map<string, LayoutItem>(moved.map((item) => [item.blockId, item] as const));
  const others = moved
    .filter((item) => !blockIds.has(item.blockId))
    .toSorted((a, b) => a.y - b.y || a.x - b.x || a.blockId.localeCompare(b.blockId));
  for (const item of others) {
    if (item.hidden) {
      continue;
    }
    let next = item;
    let collider = placed.find((p) => overlaps(p, next));
    while (collider) {
      next = { ...next, y: collider.y + collider.height };
      collider = placed.find((p) => overlaps(p, next));
    }
    placed.push(next);
    out.set(item.blockId, next);
  }
  return moved.map((item) => out.get(item.blockId) ?? item);
}
