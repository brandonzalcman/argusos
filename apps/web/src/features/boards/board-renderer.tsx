import type {
  BlockRegistry,
  BoardRendererPort,
  BoardRendererProps,
  LayoutBreakpoint,
  LayoutItem,
} from "@argus/blocks";
import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { BlockView } from "./blocks/block-view.js";
import {
  breakpointForWidth,
  collapseEmptyRows,
  resolveBreakpointItems,
  stackItems,
} from "./layout-ops.js";
import type { BlockDefinition } from "./model.js";
import { ErrorState } from "./states.js";

/** Tracks the viewport breakpoint (phone/tablet/desktop/video-wall); defaults to desktop before mount. */
export function useBreakpoint(): LayoutBreakpoint {
  const [breakpoint, setBreakpoint] = useState<LayoutBreakpoint>(() =>
    typeof window === "undefined" ? "desktop" : breakpointForWidth(window.innerWidth),
  );
  useEffect(() => {
    const onResize = (): void => setBreakpoint(breakpointForWidth(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return breakpoint;
}

interface BoundaryProps {
  readonly name: string;
  readonly children: ReactNode;
}

/** Contains a failing block so one bad block never blanks the board. */
export class BlockErrorBoundary extends Component<BoundaryProps, { error: unknown }> {
  override state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // TODO(implementation): report a redacted block-failure span via PerformanceInstrumentationPort.
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <section className="boards-block">
          <header className="boards-block-header">
            <h3 className="boards-block-title">{this.props.name}</h3>
          </header>
          <div className="boards-block-body">
            <ErrorState
              title="This block failed to render"
              error={this.state.error}
              onRetry={() => this.setState({ error: null })}
            />
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

export function gridStyle(item: LayoutItem): CSSProperties {
  return {
    gridColumn: `${item.x + 1} / span ${item.width}`,
    gridRow: `${item.y + 1} / span ${item.height}`,
  };
}

function displayNameFor(registry: BlockRegistry, block: BlockDefinition): string {
  try {
    return registry.get(block.type).displayName;
  } catch {
    return block.type;
  }
}

export type BoardGridProps = BoardRendererProps & {
  /** Overrides viewport detection (used by tests and the builder preview). */
  readonly breakpoint?: LayoutBreakpoint;
};

/**
 * Runtime grid: resolves the authored layout for the viewport breakpoint and renders each block.
 *
 * Security: a block with a visibility expression is hidden (fail closed) until the CEL evaluator in
 * @argus/expr is implemented — it is never shown "just in case". Server-side field/view policies
 * still apply to all data; hiding here is a presentation concern, not authorization.
 * TODO(implementation): evaluate visibility with @argus/expr `evaluateVisibilityExpression`.
 */
export function BoardGrid(props: BoardGridProps): ReactElement {
  const detected = useBreakpoint();
  const requested = props.breakpoint ?? detected;
  const { items, breakpoint } = resolveBreakpointItems(props.layout, requested);
  const blocks = new Map(props.definition.blocks.map((b) => [b.id, b] as const));
  const stacked = requested === "phone";
  const ordered = stacked
    ? stackItems(items)
    : collapseEmptyRows(items.filter((item) => !item.hidden)).toSorted(
        (a, b) => a.y - b.y || a.x - b.x,
      );

  let hiddenByCondition = 0;
  const cells: ReactElement[] = [];
  for (const item of ordered) {
    const block = blocks.get(item.blockId);
    if (!block) continue;
    if (block.visibilityExpression !== null) {
      hiddenByCondition += 1;
      continue;
    }
    cells.push(
      <div
        key={block.id}
        style={
          stacked ? { minHeight: `calc(var(--boards-row) * ${item.height})` } : gridStyle(item)
        }
      >
        <BlockErrorBoundary name={block.name}>
          <BlockView
            block={block}
            displayName={displayNameFor(props.registry, block)}
            definition={props.definition}
            context={props.context}
            data={props.data}
            live={props.context.mode !== "builder"}
          />
        </BlockErrorBoundary>
      </div>,
    );
  }

  const className = [
    "boards-grid",
    stacked ? "boards-grid-stack" : "",
    requested === "video-wall" ? "boards-grid-video-wall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="boards-page">
      {hiddenByCondition > 0 ? (
        <p className="boards-banner boards-banner-warning" role="status">
          {hiddenByCondition} block{hiddenByCondition === 1 ? " is" : "s are"} hidden because its
          visibility condition cannot be evaluated yet (fail closed). TODO(implementation): CEL
          evaluator.
        </p>
      ) : null}
      {cells.length === 0 ? (
        <div className="boards-state">
          <strong>This board has no visible blocks</strong>
          <p className="argus-muted">Layout: {breakpoint}.</p>
        </div>
      ) : (
        <div className={className} data-breakpoint={breakpoint}>
          {cells}
        </div>
      )}
    </div>
  );
}

/**
 * Web implementation of the @argus/blocks BoardRendererPort.
 * `renderBoard` in @argus/blocks is still a throwing scaffold stub, so the web app supplies this
 * port over the same contract (definition + layout + registry + context + data port). It can be
 * swapped for the package implementation without touching callers.
 */
export const webBoardRenderer: BoardRendererPort = {
  render: (props) => <BoardGrid {...(props as unknown as BoardRendererProps)} />,
};
