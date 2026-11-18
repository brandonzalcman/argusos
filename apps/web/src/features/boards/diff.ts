import { stableStringify } from "./draft.js";
import type { BlockDefinition, BoardBundle, LayoutBreakpoint, LayoutItem } from "./model.js";

export interface FieldChange {
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

export interface BlockChange {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly changes: readonly FieldChange[];
}

export interface LayoutChange {
  readonly blockId: string;
  readonly blockName: string;
  readonly kind: "added" | "removed" | "moved" | "resized" | "moved-resized" | "visibility";
  readonly before: LayoutItem | null;
  readonly after: LayoutItem | null;
}

export interface BreakpointLayoutDiff {
  readonly breakpoint: LayoutBreakpoint;
  readonly changes: readonly LayoutChange[];
}

export interface BoardDiff {
  readonly meta: readonly FieldChange[];
  readonly added: readonly BlockDefinition[];
  readonly removed: readonly BlockDefinition[];
  readonly changed: readonly BlockChange[];
  readonly layout: readonly BreakpointLayoutDiff[];
  readonly isEmpty: boolean;
}

const show = (value: unknown): string => (value === undefined ? "(unset)" : stableStringify(value));

function compare(path: string, before: unknown, after: unknown, out: FieldChange[]): void {
  if (stableStringify(before) !== stableStringify(after)) {
    out.push({ path, before: show(before), after: show(after) });
  }
}

function diffBlock(before: BlockDefinition, after: BlockDefinition): readonly FieldChange[] {
  const out: FieldChange[] = [];
  compare("name", before.name, after.name, out);
  compare("type", before.type, after.type, out);
  compare("visibilityExpression", before.visibilityExpression, after.visibilityExpression, out);
  compare("action", before.action, after.action, out);
  compare("access", before.access, after.access, out);
  const keys = [
    ...new Set([...Object.keys(before.config), ...Object.keys(after.config)]),
  ].toSorted();
  for (const key of keys) {
    compare(`config.${key}`, before.config[key], after.config[key], out);
  }
  return out;
}

function layoutKind(before: LayoutItem, after: LayoutItem): LayoutChange["kind"] | null {
  const moved = before.x !== after.x || before.y !== after.y;
  const resized = before.width !== after.width || before.height !== after.height;
  if (moved && resized) return "moved-resized";
  if (moved) return "moved";
  if (resized) return "resized";
  if (before.hidden !== after.hidden) return "visibility";
  return null;
}

const breakpointOrder: readonly LayoutBreakpoint[] = ["desktop", "tablet", "phone", "video-wall"];

/**
 * Compares two board bundles by stable block identity (never by array position).
 * Pure and value-only: it neither fetches nor authorizes; callers pass already-authorized bundles.
 */
export function diffBoards(base: BoardBundle, head: BoardBundle): BoardDiff {
  const meta: FieldChange[] = [];
  compare("name", base.definition.name, head.definition.name, meta);
  compare("description", base.definition.description, head.definition.description, meta);
  compare("dataSources", base.definition.dataSources, head.definition.dataSources, meta);
  compare("views", base.definition.views, head.definition.views, meta);
  compare("access", base.definition.access, head.definition.access, meta);

  const baseBlocks = new Map(base.definition.blocks.map((b) => [b.id, b] as const));
  const headBlocks = new Map(head.definition.blocks.map((b) => [b.id, b] as const));
  const added = head.definition.blocks.filter((b) => !baseBlocks.has(b.id));
  const removed = base.definition.blocks.filter((b) => !headBlocks.has(b.id));
  const changed: BlockChange[] = [];
  for (const block of head.definition.blocks) {
    const before = baseBlocks.get(block.id);
    if (!before) continue;
    const changes = diffBlock(before, block);
    if (changes.length > 0) {
      changed.push({ id: block.id, name: block.name, type: block.type, changes });
    }
  }

  const nameOf = (id: string): string => headBlocks.get(id)?.name ?? baseBlocks.get(id)?.name ?? id;
  const layout: BreakpointLayoutDiff[] = [];
  const breakpoints = new Set<LayoutBreakpoint>([
    ...base.layout.layouts.map((l) => l.breakpoint),
    ...head.layout.layouts.map((l) => l.breakpoint),
  ]);
  for (const breakpoint of breakpointOrder.filter((bp) => breakpoints.has(bp))) {
    const before = new Map(
      (base.layout.layouts.find((l) => l.breakpoint === breakpoint)?.items ?? []).map(
        (i) => [i.blockId, i] as const,
      ),
    );
    const after = new Map(
      (head.layout.layouts.find((l) => l.breakpoint === breakpoint)?.items ?? []).map(
        (i) => [i.blockId, i] as const,
      ),
    );
    const changes: LayoutChange[] = [];
    for (const [blockId, item] of after) {
      const prev = before.get(blockId);
      if (!prev) {
        changes.push({
          blockId,
          blockName: nameOf(blockId),
          kind: "added",
          before: null,
          after: item,
        });
        continue;
      }
      const kind = layoutKind(prev, item);
      if (kind) {
        changes.push({ blockId, blockName: nameOf(blockId), kind, before: prev, after: item });
      }
    }
    for (const [blockId, item] of before) {
      if (!after.has(blockId)) {
        changes.push({
          blockId,
          blockName: nameOf(blockId),
          kind: "removed",
          before: item,
          after: null,
        });
      }
    }
    if (changes.length > 0) {
      layout.push({ breakpoint, changes });
    }
  }

  return {
    meta,
    added,
    removed,
    changed,
    layout,
    isEmpty:
      meta.length === 0 &&
      added.length === 0 &&
      removed.length === 0 &&
      changed.length === 0 &&
      layout.length === 0,
  };
}

export function summarizeDiff(diff: BoardDiff): string {
  if (diff.isEmpty) return "No changes";
  const layoutCount = diff.layout.reduce((sum, bp) => sum + bp.changes.length, 0);
  return [
    `${diff.added.length} added`,
    `${diff.removed.length} removed`,
    `${diff.changed.length} changed`,
    `${layoutCount} layout`,
    `${diff.meta.length} settings`,
  ].join(" · ");
}
