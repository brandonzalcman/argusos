import { defaultConfig, setConfigValue } from "./config-schema.js";
import {
  layoutFor,
  newItemFor,
  nudgeItem,
  placeItem,
  type Rect,
  resolveCollisions,
  withBreakpointItems,
} from "./layout-ops.js";
import type {
  BlockConfig,
  BlockDefinition,
  BlockKind,
  BoardBundle,
  LayoutBreakpoint,
  LayoutItem,
} from "./model.js";

/** Pure edit operations over the draft bundle. All return new objects; nothing mutates in place. */

export function kindLookup(bundle: BoardBundle): (blockId: string) => BlockKind | undefined {
  const map = new Map(bundle.definition.blocks.map((b) => [b.id, b.type] as const));
  return (blockId) => map.get(blockId);
}

export function addBlock(
  bundle: BoardBundle,
  kind: BlockKind,
  displayName: string,
  newId: string,
): BoardBundle {
  const block: BlockDefinition = {
    id: newId,
    type: kind,
    name: displayName,
    config: defaultConfig(kind),
    visibilityExpression: null,
    action: null,
    access: { positionIds: [], visibilityRule: null },
  };
  const breakpoints: readonly LayoutBreakpoint[] = [
    ...new Set<LayoutBreakpoint>(["desktop", ...bundle.layout.layouts.map((l) => l.breakpoint)]),
  ];
  let layout = bundle.layout;
  for (const bp of breakpoints) {
    const items = layoutFor(layout, bp);
    layout = withBreakpointItems(layout, bp, [...items, newItemFor(items, newId, kind)]);
  }
  return {
    definition: { ...bundle.definition, blocks: [...bundle.definition.blocks, block] },
    layout,
  };
}

export function removeBlock(bundle: BoardBundle, blockId: string): BoardBundle {
  return {
    definition: {
      ...bundle.definition,
      blocks: bundle.definition.blocks.filter((b) => b.id !== blockId),
    },
    layout: {
      ...bundle.layout,
      layouts: bundle.layout.layouts.map((l) => ({
        ...l,
        items: l.items.filter((item) => item.blockId !== blockId),
      })),
    },
  };
}

export function updateBlock(
  bundle: BoardBundle,
  blockId: string,
  patch: Partial<Pick<BlockDefinition, "name" | "visibilityExpression" | "config">>,
): BoardBundle {
  return {
    ...bundle,
    definition: {
      ...bundle.definition,
      blocks: bundle.definition.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    },
  };
}

export function updateBlockConfig(
  bundle: BoardBundle,
  blockId: string,
  key: string,
  value: BlockConfig[string] | undefined,
): BoardBundle {
  const block = bundle.definition.blocks.find((b) => b.id === blockId);
  return block
    ? updateBlock(bundle, blockId, { config: setConfigValue(block.config, key, value) })
    : bundle;
}

export function moveBlockTo(
  bundle: BoardBundle,
  breakpoint: LayoutBreakpoint,
  blockId: string,
  rect: Rect,
): BoardBundle {
  const items = layoutFor(bundle.layout, breakpoint);
  const next = placeItem(items, blockId, rect, kindLookup(bundle));
  return next === items
    ? bundle
    : { ...bundle, layout: withBreakpointItems(bundle.layout, breakpoint, next) };
}

export function nudgeBlock(
  bundle: BoardBundle,
  breakpoint: LayoutBreakpoint,
  blockId: string,
  delta: { dx?: number; dy?: number; dw?: number; dh?: number },
): BoardBundle {
  const items = layoutFor(bundle.layout, breakpoint);
  const next = nudgeItem(items, blockId, delta, kindLookup(bundle));
  return { ...bundle, layout: withBreakpointItems(bundle.layout, breakpoint, next) };
}

export function setBlockHidden(
  bundle: BoardBundle,
  breakpoint: LayoutBreakpoint,
  blockId: string,
  hidden: boolean,
): BoardBundle {
  const items = layoutFor(bundle.layout, breakpoint).map(
    (item): LayoutItem => (item.blockId === blockId ? { ...item, hidden } : item),
  );
  return {
    ...bundle,
    layout: withBreakpointItems(bundle.layout, breakpoint, resolveCollisions(items, blockId)),
  };
}

/** Stable JSON used for dirty checks; key order independent. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function isSameBundle(a: BoardBundle, b: BoardBundle): boolean {
  return stableStringify(a) === stableStringify(b);
}
