import {
  type LayoutDefinition,
  type LayoutItem,
  layoutItemSchema,
  type Position,
} from "@argus/schema";
import { type ReactElement, useId, useState } from "react";
import { EmptyState, ErrorState, PageHeader } from "../workflows/status-views.js";
import { useAdminSave, useHomepages, usePositions } from "./admin-queries.js";
import { findLayoutOverlaps, sortLayoutItems } from "./definition-logic.js";
import { DecisionList, PositionSelect, useBoardPreview } from "./position-preview.js";
import { QueryGate } from "./query-gate.js";
import { DraftToolbar, useDraft } from "./use-draft.js";

const DESKTOP = "desktop" as const;

function numberField(
  label: string,
  value: number,
  min: number,
  max: number | undefined,
  onChange: (n: number) => void,
): ReactElement {
  return (
    <label style={{ marginInlineEnd: "0.75rem" }}>
      {label}{" "}
      <input
        type="number"
        value={Number.isNaN(value) ? "" : value}
        min={min}
        max={max}
        style={{ width: "5rem" }}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      />
    </label>
  );
}

function HomepageEditor({
  homepage,
  position,
  positions,
}: {
  readonly homepage: LayoutDefinition;
  readonly position: Position | undefined;
  readonly positions: readonly Position[];
}): ReactElement {
  const save = useAdminSave<LayoutDefinition, LayoutDefinition>("homepages", (service, request) =>
    service.saveHomepage({
      scope: request.session.scope,
      actor: request.session.actor,
      expectedVersion: request.expectedVersion,
      definition: request.definition,
    }),
  );
  const controller = useDraft(homepage, (expectedVersion, definition) =>
    save.mutateAsync({ expectedVersion, definition }),
  );
  const { draft, edit } = controller;
  const [previewPosition, setPreviewPosition] = useState<string | null>(homepage.positionId);
  // TODO(decision): the preview port is board-centric; homepage layouts preview via their board id,
  // falling back to the layout id until a homepage-specific preview endpoint exists.
  const preview = useBoardPreview(previewPosition, {
    boardId: draft.boardId ?? draft.id,
    definitionVersion: draft.version,
  });
  const layout = draft.layouts.find((l) => l.breakpoint === DESKTOP);
  const items = layout ? sortLayoutItems(layout.items) : [];
  const overlaps = findLayoutOverlaps(items);
  const hiddenByServer = new Set(preview.data?.hiddenBlockIds ?? []);
  const headingId = useId();

  const patchItem = (blockId: string, patch: Partial<LayoutItem>): void =>
    edit((current) => ({
      ...current,
      layouts: current.layouts.map((l) =>
        l.breakpoint === DESKTOP
          ? { ...l, items: l.items.map((i) => (i.blockId === blockId ? { ...i, ...patch } : i)) }
          : l,
      ),
    }));

  return (
    <div className="argus-stack">
      <DraftToolbar controller={controller} />
      <section className="argus-panel" aria-labelledby={headingId}>
        <h2 id={headingId} style={{ marginTop: 0 }}>
          Desktop layout — {position?.name ?? "unassigned position"}
        </h2>
        <p className="argus-muted">
          Edit each block’s position in the 12-column grid. Numeric inputs replace drag-and-drop so
          the editor is fully keyboard-operable.
          {/* TODO(implementation): drag-and-drop canvas on top of this keyboard model. */}
        </p>
        {items.length === 0 ? (
          <EmptyState
            title="No blocks on this homepage"
            description="Add boards, KPIs, maps, quick actions and links once the block palette is connected."
          />
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }} className="argus-stack">
            {items.map((item) => {
              const valid = layoutItemSchema.safeParse(item);
              return (
                <li key={item.blockId} className="argus-panel">
                  <strong style={{ fontFamily: "var(--argus-font-mono)" }}>{item.blockId}</strong>
                  <div className="argus-cluster">
                    {numberField("Column", item.x, 0, 11, (x) => patchItem(item.blockId, { x }))}
                    {numberField("Row", item.y, 0, undefined, (y) =>
                      patchItem(item.blockId, { y }),
                    )}
                    {numberField("Width", item.width, 1, 12, (width) =>
                      patchItem(item.blockId, { width }),
                    )}
                    {numberField("Height", item.height, 1, undefined, (height) =>
                      patchItem(item.blockId, { height }),
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={item.hidden}
                        onChange={(e) => patchItem(item.blockId, { hidden: e.target.checked })}
                      />{" "}
                      Hidden
                    </label>
                  </div>
                  {!valid.success ? (
                    <div role="alert" style={{ color: "var(--argus-color-danger)" }}>
                      ✕ {valid.error.issues[0]?.message}
                    </div>
                  ) : null}
                  {hiddenByServer.has(item.blockId) ? (
                    <div role="status">⊘ Hidden for the previewed position by server policy.</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {overlaps.length > 0 ? (
          <ul aria-label="Layout overlaps" style={{ color: "var(--argus-color-danger)" }}>
            {overlaps.map(([a, b]) => (
              <li key={`${a}-${b}`}>
                ⚠ Blocks {a} and {b} overlap.
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="argus-panel" aria-labelledby="homepage-preview-heading">
        <h2 id="homepage-preview-heading" style={{ marginTop: 0 }}>
          Position preview
        </h2>
        <PositionSelect
          positions={positions}
          value={previewPosition}
          onChange={setPreviewPosition}
        />
        {previewPosition === null ? (
          <p className="argus-muted">Choose a position to preview what it can see.</p>
        ) : preview.isError ? (
          <ErrorState
            title="Server policy preview unavailable"
            error={preview.error}
            onRetry={() => void preview.refetch()}
          />
        ) : preview.data ? (
          <DecisionList result={preview.data} />
        ) : (
          <p role="status">Evaluating server policy…</p>
        )}
      </section>
    </div>
  );
}

/**
 * Position homepages admin (/admin/positions): pick a position's homepage layout, edit block
 * placement accessibly, and preview server-authoritative visibility for any position.
 */
export function PositionHomepagesScreen(): ReactElement {
  const homepages = useHomepages();
  const positionsQuery = usePositions();
  const [selected, setSelected] = useState<string | null>(null);
  const pickerId = useId();
  return (
    <article className="argus-stack">
      <PageHeader
        title="Position homepages"
        description="Boards, KPIs, maps, actions and links laid out per position."
      />
      <QueryGate
        query={positionsQuery}
        noun="positions"
        emptyDescription="No positions exist, so no homepage can be assigned."
      >
        {(positions) => (
          <QueryGate
            query={homepages}
            noun="homepages"
            emptyDescription="No position homepage layouts exist yet."
          >
            {(layouts) => {
              if (layouts.length === 0) {
                return (
                  <EmptyState
                    title="No homepages yet"
                    description="Position homepages are created through the layout API (TODO(implementation))."
                  />
                );
              }
              const current = layouts.find((l) => l.id === selected) ?? layouts[0];
              if (!current) return null;
              return (
                <>
                  <div>
                    <label htmlFor={pickerId} style={{ display: "block", fontWeight: 600 }}>
                      Homepage
                    </label>
                    <select
                      id={pickerId}
                      value={current.id}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {layouts.map((layout) => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name} —{" "}
                          {positions.find((p) => p.id === layout.positionId)?.name ?? "no position"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <HomepageEditor
                    key={current.id}
                    homepage={current}
                    position={positions.find((p) => p.id === current.positionId)}
                    positions={positions}
                  />
                </>
              );
            }}
          </QueryGate>
        )}
      </QueryGate>
    </article>
  );
}
