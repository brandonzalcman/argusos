import type { LayoutItem } from "@argus/schema";
import { cn, focusRing } from "@argus/ui";
import { EyeOff, GripVertical } from "@argus/ui/icons";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clampLayoutItem,
  findLayoutOverlaps,
  GRID_COLUMNS,
  moveLayoutItem,
  pixelsToCells,
  resizeLayoutItem,
} from "./definition-logic.js";

const ROW_HEIGHT_PX = 56;
const SPARE_ROWS = 2;

type Gesture = "move" | "resize";

interface ActiveDrag {
  readonly blockId: string;
  readonly gesture: Gesture;
  readonly startX: number;
  readonly startY: number;
  readonly origin: LayoutItem;
  readonly preview: LayoutItem;
}

export interface GridEditorProps {
  readonly items: readonly LayoutItem[];
  readonly selectedId: string | null;
  /** Block ids the server policy hides for the previewed position (display only). */
  readonly hiddenByServer?: ReadonlySet<string>;
  readonly readOnly?: boolean;
  readonly onSelect: (blockId: string) => void;
  readonly onChange: (blockId: string, next: LayoutItem) => void;
}

/**
 * Visual 12-column grid editor. Drag a block to move it, drag its corner to resize, or focus it and
 * use the arrow keys (Shift+arrows resize). A numeric fallback for the selected block lives beside
 * this grid in the page. Block ids are shown as-is: block names are not part of the layout contract.
 * Overlaps are flagged with text, not colour alone.
 */
export function GridEditor({
  items,
  selectedId,
  hiddenByServer,
  readOnly = false,
  onSelect,
  onChange,
}: GridEditorProps): ReactElement {
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cellWidth = width / GRID_COLUMNS;
  const shown = items.map((item) => (drag?.blockId === item.blockId ? drag.preview : item));
  const rows = Math.max(4, ...shown.map((i) => i.y + i.height)) + SPARE_ROWS;
  const overlapping = new Set(findLayoutOverlaps(shown).flat());

  const begin = (event: PointerEvent<HTMLElement>, item: LayoutItem, gesture: Gesture): void => {
    if (readOnly) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(item.blockId);
    setDrag({
      blockId: item.blockId,
      gesture,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
      preview: item,
    });
  };

  const track = (event: PointerEvent<HTMLElement>): void => {
    if (!drag) return;
    const { dx, dy } = pixelsToCells(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
      cellWidth,
      ROW_HEIGHT_PX,
    );
    const preview =
      drag.gesture === "move"
        ? moveLayoutItem(drag.origin, dx, dy)
        : resizeLayoutItem(drag.origin, dx, dy);
    if (
      preview.x !== drag.preview.x ||
      preview.y !== drag.preview.y ||
      preview.width !== drag.preview.width ||
      preview.height !== drag.preview.height
    ) {
      setDrag({ ...drag, preview });
    }
  };

  const finish = (): void => {
    if (
      drag &&
      (drag.preview.x !== drag.origin.x ||
        drag.preview.y !== drag.origin.y ||
        drag.preview.width !== drag.origin.width ||
        drag.preview.height !== drag.origin.height)
    ) {
      onChange(drag.blockId, clampLayoutItem(drag.preview));
    }
    setDrag(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, item: LayoutItem): void => {
    if (readOnly) return;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(
      item.blockId,
      event.shiftKey
        ? resizeLayoutItem(item, step[0], step[1])
        : moveLayoutItem(item, step[0], step[1]),
    );
  };

  return (
    <fieldset
      ref={containerRef}
      aria-label="Homepage grid, 12 columns"
      className="relative m-0 w-full min-w-0 overflow-hidden rounded-md border border-border bg-surface-sunken p-0"
      style={{
        height: `${rows * ROW_HEIGHT_PX}px`,
        backgroundImage:
          "linear-gradient(to right, var(--argus-color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--argus-color-border) 1px, transparent 1px)",
        backgroundSize: `${cellWidth || 80}px ${ROW_HEIGHT_PX}px`,
      }}
    >
      {shown.map((item) => {
        const selected = item.blockId === selectedId;
        const dragging = drag?.blockId === item.blockId;
        const overlaps = overlapping.has(item.blockId);
        const serverHidden = hiddenByServer?.has(item.blockId) ?? false;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a div is required because the resize handle is nested inside the block
          <div
            key={item.blockId}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Block ${item.blockId}: column ${item.x + 1}, row ${item.y + 1}, ${item.width} wide, ${item.height} high${item.hidden ? ", hidden" : ""}${overlaps ? ", overlaps another block" : ""}. Arrow keys move, Shift plus arrows resize.`}
            onClick={() => onSelect(item.blockId)}
            onFocus={() => onSelect(item.blockId)}
            onKeyDown={(event) => onKeyDown(event, item)}
            onPointerDown={(event) => begin(event, item, "move")}
            onPointerMove={track}
            onPointerUp={finish}
            onPointerCancel={() => setDrag(null)}
            className={cn(
              "absolute touch-none select-none rounded-md border bg-surface p-2 text-sm text-fg shadow-sm",
              focusRing,
              selected
                ? "border-accent bg-accent-subtle ring-2 ring-accent/40"
                : "border-border-strong",
              overlaps && "border-critical",
              (item.hidden || serverHidden) && "border-dashed opacity-70",
              dragging ? "cursor-grabbing shadow-md" : "cursor-grab",
            )}
            style={{
              left: `${item.x * cellWidth + 2}px`,
              top: `${item.y * ROW_HEIGHT_PX + 2}px`,
              width: `${Math.max(0, item.width * cellWidth - 4)}px`,
              height: `${item.height * ROW_HEIGHT_PX - 4}px`,
            }}
          >
            <span className="flex items-start gap-1">
              <GripVertical
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-fg-subtle"
              />
              <span className="min-w-0 break-all font-mono text-xs leading-tight">
                {item.blockId}
              </span>
            </span>
            {item.hidden || serverHidden || overlaps ? (
              <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-fg-muted">
                {item.hidden ? (
                  <span className="inline-flex items-center gap-1">
                    <EyeOff aria-hidden="true" className="size-3" /> Hidden
                  </span>
                ) : null}
                {serverHidden ? <span>Hidden by policy</span> : null}
                {overlaps ? <span className="font-medium text-critical">Overlaps</span> : null}
              </span>
            ) : null}
            {readOnly ? null : (
              <span
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  begin(event, item, "resize");
                }}
                onPointerMove={track}
                onPointerUp={finish}
                className="absolute end-0.5 bottom-0.5 size-4 cursor-nwse-resize rounded-sm border-e-2 border-b-2 border-fg-muted"
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
