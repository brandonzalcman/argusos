export interface SplitBounds {
  /** Minimum size of the first pane, in percent of the container. */
  readonly min: number;
  /** Maximum size of the first pane, in percent of the container. */
  readonly max: number;
}

/** Clamps a first-pane percentage into bounds (and 0–100), rounding to 0.1%. */
export function clampSplit(value: number, bounds: SplitBounds): number {
  const min = Math.max(0, Math.min(bounds.min, bounds.max));
  const max = Math.min(100, Math.max(bounds.min, bounds.max));
  const safe = Number.isFinite(value) ? value : (min + max) / 2;
  return Math.round(Math.min(max, Math.max(min, safe)) * 10) / 10;
}

/** Converts a pointer position into a first-pane percentage of the container. */
export function pointerToSplit(pointer: number, start: number, length: number): number {
  if (length <= 0) {
    return 50;
  }
  return ((pointer - start) / length) * 100;
}

/**
 * Keyboard behaviour for the WAI-ARIA window splitter pattern.
 * Arrow keys move 2% (10% with Shift); Home/End jump to the bounds. `reverse` flips the
 * horizontal arrows for right-to-left layouts. Returns null for keys the splitter ignores.
 */
export function splitFromKey(
  key: string,
  current: number,
  bounds: SplitBounds,
  options: {
    readonly orientation: "horizontal" | "vertical";
    readonly shift?: boolean;
    readonly reverse?: boolean;
  },
): number | null {
  const step = options.shift ? 10 : 2;
  const direction = options.reverse ? -1 : 1;
  const decreaseKey = options.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const increaseKey = options.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  switch (key) {
    case decreaseKey:
      return clampSplit(
        current - step * (options.orientation === "horizontal" ? direction : 1),
        bounds,
      );
    case increaseKey:
      return clampSplit(
        current + step * (options.orientation === "horizontal" ? direction : 1),
        bounds,
      );
    case "Home":
      return clampSplit(bounds.min, bounds);
    case "End":
      return clampSplit(bounds.max, bounds);
    default:
      return null;
  }
}
