import { bottomOf, layoutFor, withBreakpointItems } from "./layout-ops.js";
import type {
  BlockConfig,
  BlockDefinition,
  BoardBundle,
  LayoutBreakpoint,
  LayoutItem,
} from "./model.js";

/** Blocks copied from a board together with their placement at every authored breakpoint. */
export interface BlockClipboard {
  readonly sourceBoardId: string;
  readonly blocks: readonly BlockDefinition[];
  readonly placements: readonly {
    readonly breakpoint: LayoutBreakpoint;
    readonly items: readonly LayoutItem[];
  }[];
}

/**
 * Session-only clipboard shared by builders (so blocks can move between boards in one tab).
 * Intentionally not persisted and not written to the system clipboard: block configuration can
 * reference tenant data, so it never leaves the page.
 */
let sessionClipboard: BlockClipboard | null = null;

export function readSessionClipboard(): BlockClipboard | null {
  return sessionClipboard;
}

export function writeSessionClipboard(clip: BlockClipboard | null): void {
  sessionClipboard = clip;
}

export function copyBlocks(
  bundle: BoardBundle,
  blockIds: readonly string[],
  sourceBoardId: string,
): BlockClipboard | null {
  const wanted = new Set(blockIds);
  const blocks = bundle.definition.blocks.filter((b) => wanted.has(b.id));
  if (blocks.length === 0) {
    return null;
  }
  return {
    sourceBoardId,
    blocks: structuredClone(blocks),
    placements: bundle.layout.layouts.map((l) => ({
      breakpoint: l.breakpoint,
      items: structuredClone(l.items.filter((item) => wanted.has(item.blockId))),
    })),
  };
}

/** Rewrites tab membership so copied tabs only reference copied blocks (under their new ids). */
function remapConfig(config: BlockConfig, idMap: ReadonlyMap<string, string>): BlockConfig {
  const tabs = config.tabs;
  if (!Array.isArray(tabs)) {
    return config;
  }
  return {
    ...config,
    tabs: tabs.map((tab) => {
      if (tab === null || typeof tab !== "object" || Array.isArray(tab)) {
        return tab;
      }
      const blockIds = Array.isArray(tab.blockIds) ? tab.blockIds : [];
      return {
        ...tab,
        blockIds: blockIds.flatMap((id) => {
          const mapped = typeof id === "string" ? idMap.get(id) : undefined;
          return mapped ? [mapped] : [];
        }),
      };
    }),
  };
}

export interface PasteResult {
  readonly bundle: BoardBundle;
  readonly newIds: readonly string[];
  /** Human-readable issues the author should fix (references that do not exist on this board). */
  readonly warnings: readonly string[];
}

/**
 * Pastes clipboard blocks as new blocks (fresh ids) below the existing layout at every breakpoint.
 * Relative positions are kept. Permissions (`access`) and visibility expressions are copied as-is
 * and must be reviewed by the author; table references not present on the target board are
 * reported rather than silently rewritten.
 */
export function pasteBlocks(
  bundle: BoardBundle,
  clip: BlockClipboard,
  newId: () => string,
): PasteResult {
  const idMap = new Map(clip.blocks.map((b) => [b.id, newId()] as const));
  const copies: BlockDefinition[] = clip.blocks.map((b) => ({
    ...structuredClone(b),
    id: idMap.get(b.id) ?? b.id,
    name: `${b.name} (copy)`.slice(0, 200),
    config: remapConfig(structuredClone(b.config), idMap),
  }));

  const tableIds = new Set(bundle.definition.dataSources.map((s) => s.tableId));
  const warnings: string[] = [];
  for (const copy of copies) {
    const tableId = copy.config.tableId;
    if (typeof tableId === "string" && !tableIds.has(tableId)) {
      warnings.push(`${copy.name}: table is not a data source of this board.`);
    }
    if (copy.access.positionIds.length > 0 || copy.visibilityExpression !== null) {
      warnings.push(`${copy.name}: review its position access and visibility condition.`);
    }
  }

  const desktop = clip.placements.find((p) => p.breakpoint === "desktop")?.items ?? [];
  const breakpoints = [
    ...new Set<LayoutBreakpoint>([
      "desktop",
      ...bundle.layout.layouts.map((l) => l.breakpoint),
      ...clip.placements.map((p) => p.breakpoint),
    ]),
  ];
  let layout = bundle.layout;
  for (const breakpoint of breakpoints) {
    const source = clip.placements.find((p) => p.breakpoint === breakpoint)?.items ?? desktop;
    const existing = layoutFor(layout, breakpoint);
    const top = source.length > 0 ? Math.min(...source.map((i) => i.y)) : 0;
    const base = bottomOf(existing);
    const pasted = source.flatMap((item): LayoutItem[] => {
      const mapped = idMap.get(item.blockId);
      return mapped ? [{ ...item, blockId: mapped, y: item.y - top + base }] : [];
    });
    layout = withBreakpointItems(layout, breakpoint, [...existing, ...pasted]);
  }

  return {
    bundle: {
      definition: { ...bundle.definition, blocks: [...bundle.definition.blocks, ...copies] },
      layout,
    },
    newIds: copies.map((c) => c.id),
    warnings,
  };
}
