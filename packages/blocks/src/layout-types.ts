import type { LayoutBreakpoint, LayoutDefinition, LayoutItem } from "@argus/schema";

export type { LayoutBreakpoint, LayoutDefinition, LayoutItem } from "@argus/schema";

/** Shared zero-based grid placement and twelve-column bounds are validated by @argus/schema. */
export type GridPlacement = LayoutItem;
export type GridColumnStart = LayoutItem["x"];
export type GridColumnSpan = LayoutItem["width"];

/** Shared reusable versioned layout for a board or position homepage. */
export type ResponsiveBoardLayout = LayoutDefinition;

export interface LayoutIssue {
  readonly code: "out-of-bounds" | "collision" | "duplicate-block" | "unknown-block";
  readonly blockId?: string;
  readonly message: string;
}

export interface ResolvedBoardLayout {
  readonly breakpoint: LayoutBreakpoint;
  readonly placements: readonly LayoutItem[];
}

export interface LayoutViewport {
  readonly breakpoint: LayoutBreakpoint;
  readonly widthPx: number;
}

export interface BoardLayoutEnginePort {
  readonly validate: (layout: ResponsiveBoardLayout) => readonly LayoutIssue[];
  readonly resolve: (
    layout: ResponsiveBoardLayout,
    viewport: LayoutViewport,
  ) => ResolvedBoardLayout;
}
