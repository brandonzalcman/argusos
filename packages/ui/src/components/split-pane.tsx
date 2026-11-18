import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/cn.js";
import { clampSplit, pointerToSplit, splitFromKey } from "../lib/split-pane-math.js";

export interface SplitPaneProps {
  /** `horizontal` places panes side by side; `vertical` stacks them. */
  readonly orientation?: "horizontal" | "vertical";
  readonly first: ReactNode;
  readonly second: ReactNode;
  /** Controlled first-pane size in percent. */
  readonly size?: number;
  readonly defaultSize?: number;
  /** Called continuously while resizing; persist on `onSizeCommit` instead. */
  readonly onSizeChange?: (size: number) => void;
  /** Called once when a drag or key press finishes (e.g. to persist the layout). */
  readonly onSizeCommit?: (size: number) => void;
  readonly minSize?: number;
  readonly maxSize?: number;
  /** Accessible name of the separator, e.g. "Resize map and task list". */
  readonly separatorLabel: string;
  readonly className?: string;
}

/**
 * Two resizable panes with a keyboard-operable separator (WAI-ARIA window splitter): focus the
 * divider and use arrow keys (Shift for larger steps), Home and End.
 * TODO(implementation): pop-out of a pane into a separate window for multi-monitor EOC desks.
 */
export function SplitPane({
  orientation = "horizontal",
  first,
  second,
  size,
  defaultSize = 50,
  onSizeChange,
  onSizeCommit,
  minSize = 15,
  maxSize = 85,
  separatorLabel,
  className,
}: SplitPaneProps): ReactElement {
  const bounds = { min: minSize, max: maxSize };
  const [uncontrolled, setUncontrolled] = useState(() => clampSplit(defaultSize, bounds));
  const current = size === undefined ? uncontrolled : clampSplit(size, bounds);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const firstId = useId();
  const horizontal = orientation === "horizontal";

  const update = (next: number): void => {
    if (size === undefined) {
      setUncontrolled(next);
    }
    onSizeChange?.(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    if (!dragging.current || !container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const rtl = horizontal && getComputedStyle(container).direction === "rtl";
    const raw = horizontal
      ? pointerToSplit(event.clientX, rect.left, rect.width)
      : pointerToSplit(event.clientY, rect.top, rect.height);
    update(clampSplit(rtl ? 100 - raw : raw, bounds));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onSizeCommit?.(current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    const reverse = Boolean(container && getComputedStyle(container).direction === "rtl");
    const next = splitFromKey(event.key, current, bounds, {
      orientation,
      shift: event.shiftKey,
      reverse,
    });
    if (next === null) {
      return;
    }
    event.preventDefault();
    update(next);
    onSizeCommit?.(next);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full min-h-0 w-full min-w-0",
        horizontal ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div
        id={firstId}
        className="min-h-0 min-w-0 overflow-auto"
        style={{ flexBasis: `${current}%`, flexGrow: 0, flexShrink: 0 }}
      >
        {first}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focusable/interactive; this is the ARIA window-splitter pattern */}
      <div
        role="separator"
        tabIndex={0}
        aria-label={separatorLabel}
        aria-controls={firstId}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(current)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative z-(--argus-z-sticky) flex shrink-0 touch-none items-center justify-center bg-border outline-none",
          "transition-colors duration-(--argus-duration-fast) hover:bg-accent focus-visible:bg-focus",
          horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
          // Wide invisible hit area without changing the 1px visual line.
          horizontal
            ? "before:absolute before:inset-y-0 before:-inset-x-1.5 before:content-['']"
            : "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full border border-border bg-surface-raised opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
            horizontal ? "h-6 w-1.5" : "h-1.5 w-6",
          )}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{second}</div>
    </div>
  );
}
