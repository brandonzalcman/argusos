import type { BlockRenderContext, BoardDataPort } from "@argus/blocks";
import { Badge, NewRowsIndicator } from "@argus/ui";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { validateConfig } from "../config-schema.js";
import type { BlockConfig, BlockDefinition, BoardDefinition } from "../model.js";
import { EmptyState, ErrorState, LoadingState } from "../states.js";
import { BoardEmbedBody, CustomComponentBody, LinkListBody } from "./page-blocks.js";
import { type BoardRow, useBlockRows } from "./use-block-rows.js";

export interface BlockViewProps {
  readonly block: BlockDefinition;
  readonly displayName: string;
  readonly definition: BoardDefinition;
  readonly context: BlockRenderContext;
  readonly data: BoardDataPort;
  /** Builder canvases fetch once; runtime boards stay live. */
  readonly live: boolean;
}

function str(config: BlockConfig, key: string): string | undefined {
  const value = config[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function bool(config: BlockConfig, key: string): boolean {
  return config[key] === true;
}

function ScaffoldNote({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <p className="boards-scaffold-note">
      <strong>Scaffold:</strong> {children}
    </p>
  );
}

/** Renders rows for a table-backed block with loading / error / empty states handled once. */
function DataBody({
  props,
  tableId,
  viewId,
  emptyTitle,
  children,
}: {
  readonly props: BlockViewProps;
  readonly tableId: string | undefined;
  readonly viewId?: string | undefined;
  readonly emptyTitle: string;
  readonly children: (rows: readonly BoardRow[]) => ReactNode;
}): ReactElement {
  const query = useBlockRows({
    definition: props.definition,
    context: props.context,
    data: props.data,
    tableId,
    viewId,
    live: props.live,
  });
  if (tableId === undefined) return <EmptyState title="No table selected" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load data"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) {
    return <LoadingState label={`Loading ${props.block.name}`} />;
  }
  if (query.data.rows.length === 0) {
    return (
      <EmptyState title={emptyTitle}>Nothing in this view is visible to your position.</EmptyState>
    );
  }
  return <>{children(query.data.rows)}</>;
}

function recordColumns(rows: readonly BoardRow[]): readonly string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.values)) {
      keys.add(key);
      if (keys.size >= 6) return [...keys];
    }
  }
  return [...keys];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function RecordListBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const { config } = props.block;
  const pageSize = typeof config.pageSize === "number" ? config.pageSize : 25;
  return (
    <DataBody
      props={props}
      tableId={str(config, "tableId")}
      viewId={str(config, "viewId")}
      emptyTitle="No records"
    >
      {(rows) => <RecordTable rows={rows} pageSize={pageSize} label={props.block.name} />}
    </DataBody>
  );
}

/** New rows arriving after first paint are buffered behind an "N new" pill, never inserted underneath the operator. */
function RecordTable({
  rows,
  pageSize,
  label,
}: {
  readonly rows: readonly BoardRow[];
  readonly pageSize: number;
  readonly label: string;
}): ReactElement {
  const [baseline, setBaseline] = useState<ReadonlySet<string>>(
    () => new Set(rows.map((r) => r.id)),
  );
  const shown = rows.filter((row) => baseline.has(row.id));
  const pending = rows.length - shown.length;
  const columns = recordColumns(shown);
  const reveal = useCallback(() => setBaseline(new Set(rows.map((r) => r.id))), [rows]);
  return (
    <>
      <NewRowsIndicator count={pending} noun="records" onShowNewRows={reveal} />
      <table className="boards-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.slice(0, pageSize).map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column}>{formatCell(row.values[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length > pageSize ? (
        <p className="boards-scaffold-note">
          Showing {pageSize} of {shown.length} records. TODO(implementation): paging.
        </p>
      ) : null}
    </>
  );
}

function StatBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const { config } = props.block;
  const label = str(config, "label") ?? props.block.name;
  return (
    <DataBody props={props} tableId={str(config, "tableId")} emptyTitle="No records in scope">
      {(rows) => (
        <p
          className="m-0 grid min-w-0 gap-0.5"
          // TODO(implementation): aggregation definitions; until then the tile is a record count.
          title={`Record count only; aggregation "${str(config, "aggregationDefinitionId")}" is not implemented.`}
        >
          <span className="boards-visually-hidden">{label}: </span>
          <span className="boards-stat-value">{rows.length}</span>
          <span className="argus-muted truncate text-sm">records in scope</span>
        </p>
      )}
    </DataBody>
  );
}

function PendingDataBody({
  props,
  what,
}: {
  readonly props: BlockViewProps;
  readonly what: string;
}): ReactElement {
  const tableId = str(props.block.config, "tableId");
  const note = (
    <ScaffoldNote>
      {what} rendering is not implemented. TODO(implementation): {what.toLowerCase()} view.
    </ScaffoldNote>
  );
  if (!tableId) return note;
  return (
    <DataBody props={props} tableId={tableId} emptyTitle="No records">
      {(rows) => (
        <>
          <p>{rows.length} authorized records available.</p>
          {note}
        </>
      )}
    </DataBody>
  );
}

function CountdownBody({ block }: { readonly block: BlockDefinition }): ReactElement {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const timeZone = str(block.config, "timeZone") ?? "UTC";
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "medium",
      timeZoneName: "short",
    }).format(now);
  } catch {
    return (
      <ErrorState title="Invalid time zone" error={new Error(`Unknown time zone: ${timeZone}`)} />
    );
  }
  return (
    <>
      <time dateTime={now.toISOString()} style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatted}
      </time>
      {str(block.config, "targetFieldId") ? (
        <ScaffoldNote>
          Countdown to a record field needs a bound record. TODO(implementation).
        </ScaffoldNote>
      ) : null}
    </>
  );
}

interface TabConfig {
  readonly id: string;
  readonly label: string;
  readonly blockIds: readonly string[];
}

function readTabs(config: BlockConfig): readonly TabConfig[] {
  const raw = config.tabs;
  if (!Array.isArray(raw)) return [];
  const tabs: TabConfig[] = [];
  for (const item of raw) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const { id, label, blockIds } = item;
      if (typeof id === "string" && typeof label === "string") {
        tabs.push({
          id,
          label,
          blockIds: Array.isArray(blockIds)
            ? blockIds.filter((b): b is string => typeof b === "string")
            : [],
        });
      }
    }
  }
  return tabs;
}

function TabsBody({ props }: { readonly props: BlockViewProps }): ReactElement {
  const tabs = readTabs(props.block.config);
  const [selected, setSelected] = useState(0);
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (tabs.length === 0) {
    return <EmptyState title="No tabs configured" />;
  }
  const active = tabs[Math.min(selected, tabs.length - 1)] ?? tabs[0];
  const names = new Map(props.definition.blocks.map((b) => [b.id, b.name] as const));
  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    setSelected(next);
    refs.current[next]?.focus();
  };
  return (
    <>
      <div role="tablist" aria-label={props.block.name} className="boards-toolbar">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab === active}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab === active ? 0 : -1}
            className="boards-btn"
            onClick={() => setSelected(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
        >
          <ul>
            {active.blockIds.map((id) => (
              <li key={id}>{names.get(id) ?? "Unavailable block"}</li>
            ))}
          </ul>
          <ScaffoldNote>Nested block rendering. TODO(implementation).</ScaffoldNote>
        </div>
      ) : null}
    </>
  );
}

function SectionBody({ block }: { readonly block: BlockDefinition }): ReactElement {
  const title = str(block.config, "title") ?? block.name;
  if (!bool(block.config, "collapsible")) {
    return <h3 style={{ margin: 0 }}>{title}</h3>;
  }
  return (
    <details open={bool(block.config, "initiallyExpanded")}>
      <summary>{title}</summary>
      <ScaffoldNote>Section children. TODO(implementation): nested block rendering.</ScaffoldNote>
    </details>
  );
}

function Body({ props }: { readonly props: BlockViewProps }): ReactElement {
  const { block } = props;
  const { config } = block;
  switch (block.type) {
    case "record-list":
      return <RecordListBody props={props} />;
    case "stat":
      return <StatBody props={props} />;
    case "chart":
      return <PendingDataBody props={props} what="Chart" />;
    case "timeline":
      return <PendingDataBody props={props} what="Timeline" />;
    case "related-records":
      return <PendingDataBody props={props} what="Related records" />;
    case "countdown":
      return <CountdownBody block={block} />;
    case "tabs":
      return <TabsBody props={props} />;
    case "section":
      return <SectionBody block={block} />;
    case "divider":
      return (
        <hr aria-orientation={config.orientation === "vertical" ? "vertical" : "horizontal"} />
      );
    case "rich-text":
      // Rendered as inert text; never as HTML.
      return (
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{str(config, "contentDocument") ?? ""}</p>
      );
    case "button":
      return (
        <>
          <button type="button" className="boards-btn" disabled>
            {str(config, "label") ?? block.name}
          </button>
          <ScaffoldNote>
            Actions are not connected. TODO(implementation): action execution API.
          </ScaffoldNote>
        </>
      );
    case "image":
      return (
        <ScaffoldNote>
          Image “{str(config, "altText")}” cannot load: attachment URL resolver
          TODO(implementation).
        </ScaffoldNote>
      );
    case "embed":
      return (
        <ScaffoldNote>
          Sandboxed embed for {str(config, "allowlistedOrigin")} is not rendered.
          TODO(implementation).
        </ScaffoldNote>
      );
    case "map":
      return <ScaffoldNote>Map layers via @argus/maps. TODO(implementation).</ScaffoldNote>;
    case "field-input":
    case "field-display":
      return (
        <ScaffoldNote>Needs a bound record. TODO(implementation): record binding.</ScaffoldNote>
      );
    case "comments":
    case "checklist":
    case "attachment-gallery":
    case "weather":
      return <ScaffoldNote>{props.displayName} view. TODO(implementation).</ScaffoldNote>;
    case "board-embed":
      return <BoardEmbedBody props={props} />;
    case "link-list":
      return <LinkListBody props={props} />;
    case "custom-component":
      return <CustomComponentBody props={props} />;
  }
}

/**
 * Web view for one block: frame, configuration check, then the kind-specific body.
 * Input: the block definition, registry display name, render context and scoped data port.
 * Output: an accessible region with its own loading/error/empty states.
 * Errors: a throwing body is contained by the caller's error boundary (see BoardGrid).
 * Depends on: @argus/blocks BoardDataPort; hidden/forbidden data never reaches this component.
 */
export function BlockView(props: BlockViewProps): ReactElement {
  const { block } = props;
  const issues = validateConfig(block.type, block.config);
  const titleId = useId();
  return (
    <section className="boards-block" aria-labelledby={titleId} data-block-kind={block.type}>
      <header className="boards-block-header">
        <h3 className="boards-block-title" id={titleId} title={block.name}>
          {block.name}
        </h3>
        <Badge size="sm" tone="neutral" variant="outline" className="boards-block-kind">
          {props.displayName}
        </Badge>
      </header>
      <div className="boards-block-body">
        {issues.length > 0 ? (
          <div className="boards-state boards-state-error" role="alert">
            <strong>Not configured</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue.key}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <Body props={props} />
        )}
      </div>
    </section>
  );
}
