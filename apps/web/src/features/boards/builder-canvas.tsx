import type { BlockRegistry, BlockRenderContext, BoardDataPort } from "@argus/blocks";
import { IconButton } from "@argus/ui";
import { GripVertical } from "@argus/ui/icons";
import {
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
} from "react";
import { BlockView } from "./blocks/block-view.js";
import { BlockErrorBoundary, gridStyle } from "./board-renderer.js";
import { kindLookup } from "./draft.js";
import { GRID_COLUMNS, moveGroup, placeItem, type Rect } from "./layout-ops.js";
import type {
  BlockDefinition,
  BlockKind,
  BoardBundle,
  LayoutBreakpoint,
  LayoutItem,
} from "./model.js";

export const PALETTE_MIME = "application/x-argus-block-kind";

interface Gesture {
  readonly blockId: string;
  readonly mode: "move" | "resize";
  readonly startX: number;
  readonly startY: number;
  readonly origin: LayoutItem;
  readonly colStep: number;
  readonly rowStep: number;
  readonly items: readonly LayoutItem[];
  /** Blocks moved together when the dragged block is part of a multi-selection. */
  readonly group: ReadonlySet<string> | null;
}

export interface BuilderCanvasProps {
  readonly bundle: BoardBundle;
  readonly items: readonly LayoutItem[];
  readonly breakpoint: LayoutBreakpoint;
  readonly selectedId: string | null;
  readonly selectedIds: readonly string[];
  /** Blocks the previewed position cannot see (server-authoritative preview). */
  readonly previewHiddenIds?: ReadonlySet<string>;
  readonly previewLabel?: string;
  readonly registry: BlockRegistry;
  readonly context: BlockRenderContext;
  readonly data: BoardDataPort;
  /** `additive` (Shift/Ctrl/Cmd) toggles the block in the multi-selection. */
  readonly onSelect: (blockId: string | null, additive?: boolean) => void;
  /** Commits a finished multi-block drag as one undo step. */
  readonly onMoveGroup: (ids: readonly string[], dx: number, dy: number, announce: string) => void;
  /** Commits one finished pointer gesture or keyboard move as a single undo step. */
  readonly onPlace: (blockId: string, rect: Rect, announce: string) => void;
  readonly onNudge: (
    blockId: string,
    delta: { dx?: number; dy?: number; dw?: number; dh?: number },
    announce: string,
  ) => void;
  readonly onRemove: (blockId: string) => void;
  readonly onDropKind: (kind: BlockKind, cell: { x: number; y: number }) => void;
}

function measure(grid: HTMLElement): { colStep: number; rowStep: number; rect: DOMRect } {
  const style = getComputedStyle(grid);
  const colGap = Number.parseFloat(style.columnGap) || 0;
  const rowGap = Number.parseFloat(style.rowGap) || 0;
  const rowHeight = Number.parseFloat(style.gridAutoRows) || 64;
  const rect = grid.getBoundingClientRect();
  return {
    colStep: (rect.width + colGap) / GRID_COLUMNS,
    rowStep: rowHeight + rowGap,
    rect,
  };
}

const arrowDelta: Readonly<Record<string, { dx?: number; dy?: number }>> = {
  ArrowLeft: { dx: -1 },
  ArrowRight: { dx: 1 },
  ArrowUp: { dy: -1 },
  ArrowDown: { dy: 1 },
};

function describe(item: LayoutItem): string {
  return `column ${item.x + 1}, row ${item.y + 1}, ${item.width} wide, ${item.height} tall`;
}

/**
 * Editable 12-column canvas rendering real block views.
 * Mouse/touch: drag the move handle, drag the corner to resize, drop palette items.
 * Keyboard: focus a block, then Alt+Arrows to move, Alt+Shift+Arrows to resize, Delete to remove.
 * The inspector offers numeric and button alternatives for every gesture (WCAG 2.5.7).
 */
export function BuilderCanvas(props: BuilderCanvasProps): ReactElement {
  const { bundle, items, selectedId, selectedIds, registry, context, data } = props;
  const gridRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<readonly LayoutItem[] | null>(null);
  const blocks = new Map(bundle.definition.blocks.map((b) => [b.id, b] as const));
  const shownItems = (preview ?? items).filter((item) => !item.hidden);
  const kindOf = kindLookup(bundle);

  const begin = (
    event: PointerEvent<HTMLElement>,
    item: LayoutItem,
    mode: Gesture["mode"],
  ): void => {
    const grid = gridRef.current;
    if (!grid || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { colStep, rowStep } = measure(grid);
    gestureRef.current = {
      blockId: item.blockId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
      colStep,
      rowStep,
      items,
      group:
        mode === "move" && selectedIds.length > 1 && selectedIds.includes(item.blockId)
          ? new Set(selectedIds)
          : null,
    };
    if (!(mode === "move" && selectedIds.length > 1 && selectedIds.includes(item.blockId))) {
      props.onSelect(item.blockId, event.shiftKey || event.ctrlKey || event.metaKey);
    }
  };

  const deltaFor = (
    gesture: Gesture,
    event: PointerEvent<HTMLElement>,
  ): { dx: number; dy: number } => ({
    dx: Math.round((event.clientX - gesture.startX) / gesture.colStep),
    dy: Math.round((event.clientY - gesture.startY) / gesture.rowStep),
  });

  const rectFor = (gesture: Gesture, event: PointerEvent<HTMLElement>): Rect => {
    const { dx, dy } = deltaFor(gesture, event);
    const { origin } = gesture;
    return gesture.mode === "move"
      ? { x: origin.x + dx, y: origin.y + dy, width: origin.width, height: origin.height }
      : { x: origin.x, y: origin.y, width: origin.width + dx, height: origin.height + dy };
  };

  const move = (event: PointerEvent<HTMLElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.group) {
      const { dx, dy } = deltaFor(gesture, event);
      setPreview(moveGroup(gesture.items, gesture.group, dx, dy));
      return;
    }
    setPreview(placeItem(gesture.items, gesture.blockId, rectFor(gesture, event), kindOf));
  };

  const end = (event: PointerEvent<HTMLElement>, commit: boolean): void => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setPreview(null);
    if (!gesture || !commit) return;
    if (gesture.group) {
      const { dx, dy } = deltaFor(gesture, event);
      if (dx !== 0 || dy !== 0) {
        props.onMoveGroup([...gesture.group], dx, dy, `${gesture.group.size} blocks moved.`);
      }
      return;
    }
    const rect = rectFor(gesture, event);
    const placed = placeItem(gesture.items, gesture.blockId, rect, kindOf).find(
      (i) => i.blockId === gesture.blockId,
    );
    if (placed) {
      const name = blocks.get(gesture.blockId)?.name ?? "Block";
      props.onPlace(
        gesture.blockId,
        placed,
        `${name} ${gesture.mode === "move" ? "moved" : "resized"}: ${describe(placed)}.`,
      );
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, block: BlockDefinition): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onSelect(block.id, event.shiftKey || event.ctrlKey || event.metaKey);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      props.onRemove(block.id);
    } else if (event.altKey && event.key in arrowDelta) {
      event.preventDefault();
      const delta = arrowDelta[event.key] ?? {};
      props.onNudge(
        block.id,
        event.shiftKey ? { dw: delta.dx ?? 0, dh: delta.dy ?? 0 } : delta,
        `${block.name} ${event.shiftKey ? "resized" : "moved"}.`,
      );
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const kind = event.dataTransfer.getData(PALETTE_MIME);
    const grid = gridRef.current;
    if (!grid || !registry.list().some((m) => m.kind === kind)) return;
    event.preventDefault();
    const { colStep, rowStep, rect } = measure(grid);
    props.onDropKind(kind as BlockKind, {
      x: Math.floor((event.clientX - rect.left) / colStep),
      y: Math.floor((event.clientY - rect.top) / rowStep),
    });
  };

  return (
    <section
      className="boards-canvas"
      aria-label={`Board canvas, ${props.breakpoint} layout`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(PALETTE_MIME)) event.preventDefault();
      }}
      onDrop={onDrop}
    >
      {shownItems.length === 0 ? (
        <p className="boards-state">
          <strong>Empty board</strong>
          <span className="argus-muted">
            Add blocks from the palette using the Add button or by dragging them here.
          </span>
        </p>
      ) : null}
      <div ref={gridRef} className="boards-grid" data-breakpoint={props.breakpoint}>
        {shownItems.map((item) => {
          const block = blocks.get(item.blockId);
          if (!block) return null;
          let displayName: string = block.type;
          try {
            displayName = registry.get(block.type).displayName;
          } catch {
            // Unknown kind: BlockView still renders its frame; the label falls back to the kind.
          }
          const selected = selectedIds.includes(item.blockId);
          const previewHidden = props.previewHiddenIds?.has(item.blockId) ?? false;
          const dragging = gestureRef.current?.blockId === item.blockId;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a grid item is a focusable group with custom key handling
            <div
              key={item.blockId}
              className="boards-canvas-block"
              role="group"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the block itself must be keyboard-focusable to move/resize it
              tabIndex={0}
              data-selected={item.blockId === selectedId}
              data-multi={selected && selectedIds.length > 1}
              data-preview-hidden={previewHidden}
              data-dragging={dragging}
              style={gridStyle(item)}
              aria-roledescription="movable block"
              aria-label={`${block.name}, ${displayName}, ${describe(item)}${selected ? ", selected" : ""}. Alt plus arrow keys move, Alt Shift plus arrow keys resize, Delete removes.`}
              onClick={(event) =>
                props.onSelect(item.blockId, event.shiftKey || event.ctrlKey || event.metaKey)
              }
              onKeyDown={(event) => onKeyDown(event, block)}
            >
              <BlockErrorBoundary name={block.name}>
                <BlockView
                  block={block}
                  displayName={displayName}
                  definition={bundle.definition}
                  context={context}
                  data={data}
                  live={false}
                />
              </BlockErrorBoundary>
              {block.visibilityExpression !== null ? (
                <span
                  className="boards-badge boards-badge-warning"
                  style={{ position: "absolute", insetBlockEnd: 4, insetInlineStart: 4 }}
                >
                  Conditional
                </span>
              ) : null}
              {previewHidden ? (
                <span
                  className="boards-badge boards-badge-danger"
                  style={{ position: "absolute", insetBlockEnd: 4, insetInlineEnd: 24 }}
                >
                  Hidden for {props.previewLabel ?? "this position"}
                </span>
              ) : null}
              <IconButton
                tabIndex={-1}
                size="sm"
                variant="ghost"
                tooltipSide="left"
                className="boards-grip"
                icon={<GripVertical />}
                label={`Drag to move ${block.name}`}
                aria-description="Keyboard users: select the block and press Alt plus arrow keys."
                onPointerDown={(event) => begin(event, item, "move")}
                onPointerMove={move}
                onPointerUp={(event) => end(event, true)}
                onPointerCancel={(event) => end(event, false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    gestureRef.current = null;
                    setPreview(null);
                  }
                }}
              />
              <button
                type="button"
                tabIndex={-1}
                className="boards-resize"
                aria-label={`Drag to resize ${block.name}. Keyboard users: select the block and press Alt Shift plus arrow keys.`}
                title="Resize"
                onPointerDown={(event) => begin(event, item, "resize")}
                onPointerMove={move}
                onPointerUp={(event) => end(event, true)}
                onPointerCancel={(event) => end(event, false)}
              >
                <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                  <path
                    d="M9 3 3 9M9 6 6 9"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
