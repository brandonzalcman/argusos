import type { DefinitionIssue, JsonValue } from "@argus/schema";
import { blockDefinitionSchema, boardBundleSchema } from "@argus/schema";
import { isSameBundle } from "./draft.js";
import { validateItems } from "./layout-ops.js";
import type { BlockDefinition, BoardBundle } from "./model.js";

/**
 * Pure logic for the "code modification" half of dev mode in the board builder: semantic
 * validation on top of the Zod schemas, the one-step replace operations, the eject replacement and
 * the gating rules. No React, no I/O; the components call these and dispatch a single builder edit.
 */

/** Schemas the code views validate against (re-exported so callers do not import @argus/schema). */
export const boardBundleCodeSchema = boardBundleSchema;
export const blockCodeSchema = blockDefinitionSchema;

// ---------------------------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------------------------

export interface CodeAccessInput {
  /** Dev mode is switched on and available for the session. */
  readonly devModeEnabled: boolean;
  /** Session StudioPermissions (server-authoritative). */
  readonly editDefinitions: boolean;
  readonly editCode: boolean;
  /**
   * Per-board server permission (BoardSummary.permissions.edit). `undefined` while the summary is
   * loading; the builder page already blocks when it is explicitly false.
   */
  readonly boardEdit: boolean | undefined;
}

export interface CodeAccess {
  /** Show the Design | Code switch and the inspector Code tab. */
  readonly visible: boolean;
  /** Code views accept edits. Otherwise they are read-only. */
  readonly editable: boolean;
  /** "Customize code" (eject) may be offered. */
  readonly canEject: boolean;
}

/**
 * Code views are only visible in dev mode. They are editable only with `editCode` AND per-board
 * edit permission; the visual builder itself needs nothing beyond the page's own edit gate.
 */
export function resolveCodeAccess(input: CodeAccessInput): CodeAccess {
  const boardAllows = input.boardEdit !== false;
  const editable = input.devModeEnabled && input.editCode && boardAllows;
  return {
    visible: input.devModeEnabled,
    editable,
    canEject: editable && input.editDefinitions,
  };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const error = (path: DefinitionIssue["path"], message: string): DefinitionIssue => ({
  path: [...path],
  message,
  severity: "error",
});

/**
 * Semantic checks for a whole bundle (beyond the schema): duplicate block ids, layout items that
 * reference missing or duplicated blocks, items outside the 12-column grid (x + width <= 12), and
 * identity fields that must not change. Overlaps are warnings (the canvas can resolve them).
 */
export function validateBundleSemantics(
  next: BoardBundle,
  original: BoardBundle,
): readonly DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const { definition, layout } = next;

  if (definition.id !== original.definition.id) {
    issues.push(error(["definition", "id"], "The board id cannot be changed."));
  }
  if (definition.tenantId !== original.definition.tenantId) {
    issues.push(error(["definition", "tenantId"], "The tenant cannot be changed."));
  }
  if (definition.version !== original.definition.version) {
    issues.push(
      error(
        ["definition", "version"],
        "The version is managed by the server and cannot be edited.",
      ),
    );
  }
  if (layout.id !== original.layout.id || definition.layoutId !== layout.id) {
    issues.push(
      error(["layout", "id"], "The layout id must stay the same and match definition.layoutId."),
    );
  }

  const known = new Set<string>();
  definition.blocks.forEach((block, index) => {
    if (known.has(block.id)) {
      issues.push(error(["definition", "blocks", index, "id"], `Duplicate block id ${block.id}.`));
    }
    known.add(block.id);
  });

  layout.layouts.forEach((breakpointLayout, layoutIndex) => {
    for (const problem of validateItems(breakpointLayout.items, known)) {
      const itemIndex = breakpointLayout.items.findIndex(
        (item) => item.blockId === problem.blockId,
      );
      const path = [
        "layout",
        "layouts",
        layoutIndex,
        "items",
        Math.max(itemIndex, 0),
        problem.code === "out-of-bounds" ? "width" : "blockId",
      ];
      const where = `${breakpointLayout.breakpoint}: `;
      if (problem.code === "collision") {
        issues.push({ path, message: `${where}${problem.message}`, severity: "warning" });
      } else if (problem.code === "unknown-block") {
        issues.push(
          error(path, `${where}layout item references missing block ${problem.blockId}.`),
        );
      } else if (problem.code === "duplicate-block") {
        issues.push(error(path, `${where}block ${problem.blockId} is placed twice.`));
      } else {
        issues.push(error(path, `${where}block ${problem.blockId} exceeds the 12-column grid.`));
      }
    }
  });
  return issues;
}

/** Semantic checks for one block's code: the id must stay the same. */
export function validateBlockSemantics(
  next: BlockDefinition,
  originalId: string,
): readonly DefinitionIssue[] {
  return next.id === originalId
    ? []
    : [error(["id"], `The block id cannot be changed (expected ${originalId}).`)];
}

// ---------------------------------------------------------------------------------------------
// Replace operations (each result is applied as ONE builder edit = one undo step)
// ---------------------------------------------------------------------------------------------

export type ReplaceResult =
  | { readonly ok: true; readonly bundle: BoardBundle }
  | { readonly ok: false; readonly issues: readonly DefinitionIssue[] };

/** Replaces the whole bundle; a bundle with semantic errors is refused and never returned. */
export function replaceBundle(current: BoardBundle, next: BoardBundle): ReplaceResult {
  const issues = validateBundleSemantics(next, current);
  if (issues.some((issue) => issue.severity === "error")) return { ok: false, issues };
  return { ok: true, bundle: next };
}

/** Replaces one block in place (same id, same layout items). Changing the id is refused. */
export function replaceBlock(
  current: BoardBundle,
  blockId: string,
  next: BlockDefinition,
): ReplaceResult {
  if (!current.definition.blocks.some((block) => block.id === blockId)) {
    return { ok: false, issues: [error([], `Block ${blockId} no longer exists.`)] };
  }
  const issues = validateBlockSemantics(next, blockId);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    bundle: {
      ...current,
      definition: {
        ...current.definition,
        blocks: current.definition.blocks.map((block) => (block.id === blockId ? next : block)),
      },
    },
  };
}

export interface EjectedComponent {
  readonly componentId: string;
  readonly componentVersion: number;
  /** Initial prop values (e.g. mapped from the ejected block config). */
  readonly props?: { readonly [key: string]: JsonValue };
}

/**
 * Replaces a built-in block with a `custom-component` block that keeps the id, name, layout,
 * visibility, action and access. Built-ins only; a custom-component block is left untouched.
 */
export function ejectBlockToComponent(
  current: BoardBundle,
  blockId: string,
  component: EjectedComponent,
): BoardBundle {
  const block = current.definition.blocks.find((b) => b.id === blockId);
  if (!block || block.type === "custom-component") return current;
  const replacement: BlockDefinition = {
    ...block,
    type: "custom-component",
    config: {
      componentId: component.componentId,
      componentVersion: component.componentVersion,
      props: { ...(component.props ?? {}) },
    },
  };
  const result = replaceBlock(current, blockId, replacement);
  return result.ok ? result.bundle : current;
}

/** True when applying `next` would change the draft (no-op edits create no undo step). */
export function changesBundle(current: BoardBundle, next: BoardBundle): boolean {
  return !isSameBundle(current, next);
}
