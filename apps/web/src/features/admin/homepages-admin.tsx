import {
  type LayoutBreakpoint,
  type LayoutDefinition,
  type LayoutItem,
  layoutItemSchema,
  type Position,
} from "@argus/schema";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@argus/ui";
import { TriangleAlert } from "@argus/ui/icons";
import { type ReactElement, type ReactNode, useState } from "react";
import { ErrorState } from "../workflows/status-views.js";
import { useAdminSave, useHomepages, usePositions } from "./admin-queries.js";
import { clampLayoutItem, findLayoutOverlaps } from "./definition-logic.js";
import { GridEditor } from "./grid-editor.js";
import { DecisionList, PositionSelect, useBoardPreview } from "./position-preview.js";
import { QueryGate } from "./query-gate.js";
import { DraftActions, DraftConflict, useDraft } from "./use-draft.js";

const BREAKPOINT_ORDER: readonly LayoutBreakpoint[] = ["desktop", "tablet", "phone", "video-wall"];

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max?: number;
  readonly onChange: (next: number) => void;
}): ReactElement {
  return (
    <Field label={label}>
      <Input
        type="number"
        mono
        min={min}
        {...(max === undefined ? {} : { max })}
        value={Number.isNaN(value) ? "" : value}
        onChange={(event) =>
          onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
        }
      />
    </Field>
  );
}

/** Numeric fallback for the selected block: same edits as the grid, with schema validation. */
function BlockNumbers({
  item,
  onChange,
}: {
  readonly item: LayoutItem;
  readonly onChange: (next: LayoutItem) => void;
}): ReactElement {
  const valid = layoutItemSchema.safeParse(item);
  return (
    <div className="grid gap-3">
      <p className="break-all font-mono text-sm text-fg-muted">{item.blockId}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Column"
          value={item.x}
          min={0}
          max={11}
          onChange={(x) => onChange({ ...item, x })}
        />
        <NumberField
          label="Row"
          value={item.y}
          min={0}
          onChange={(y) => onChange({ ...item, y })}
        />
        <NumberField
          label="Width"
          value={item.width}
          min={1}
          max={12}
          onChange={(width) => onChange({ ...item, width })}
        />
        <NumberField
          label="Height"
          value={item.height}
          min={1}
          onChange={(height) => onChange({ ...item, height })}
        />
      </div>
      <Switch
        label="Hidden on this breakpoint"
        checked={item.hidden}
        onCheckedChange={(hidden) => onChange({ ...item, hidden })}
      />
      {!valid.success ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-critical">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {valid.error.issues[0]?.message}
        </p>
      ) : null}
    </div>
  );
}

function HomepageEditor({
  homepage,
  position,
  positions,
  picker,
}: {
  readonly picker: ReactNode;
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
  const available = BREAKPOINT_ORDER.filter((bp) => draft.layouts.some((l) => l.breakpoint === bp));
  const [breakpoint, setBreakpoint] = useState<LayoutBreakpoint>(available[0] ?? "desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<string | null>(homepage.positionId);
  // TODO(decision): the preview port is board-centric; homepage layouts preview via their board id,
  // falling back to the layout id until a homepage-specific preview endpoint exists.
  const preview = useBoardPreview(previewPosition, {
    boardId: draft.boardId ?? draft.id,
    definitionVersion: draft.version,
  });
  const hiddenByServer = new Set(preview.data?.hiddenBlockIds ?? []);

  const patchItem = (blockId: string, next: LayoutItem): void =>
    edit((current) => ({
      ...current,
      layouts: current.layouts.map((l) =>
        l.breakpoint === breakpoint
          ? { ...l, items: l.items.map((i) => (i.blockId === blockId ? next : i)) }
          : l,
      ),
    }));

  return (
    <PageContainer width="full">
      <PageHeader
        title="Position homepages"
        description="Boards, KPIs, maps, actions and links laid out per position."
        actions={<DraftActions controller={controller} />}
        meta={
          <>
            <Badge tone="neutral">{draft.name}</Badge>
            <Badge tone="neutral" variant="outline">
              {position?.name ?? "No position assigned"}
            </Badge>
          </>
        }
      />
      <DraftConflict
        controller={controller}
        recordLabel={draft.name}
        describe={(mine, theirs) => [
          {
            fieldId: "blocks",
            fieldLabel: "Placed blocks",
            localValue: String(mine.layouts.reduce((n, l) => n + l.items.length, 0)),
            serverValue: String(theirs.layouts.reduce((n, l) => n + l.items.length, 0)),
          },
        ]}
      />
      {picker}
      <div className="grid items-start gap-(--argus-gap) xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Panel
          title="Layout"
          description="Drag a block to move it, drag its corner to resize. Keyboard: arrow keys move, Shift plus arrows resize."
        >
          {available.length === 0 ? (
            <EmptyState
              title="No layouts authored"
              description="This homepage has no breakpoint layouts yet. Add blocks once the block palette is connected."
            />
          ) : (
            <Tabs
              value={breakpoint}
              onValueChange={(next) => setBreakpoint(next as LayoutBreakpoint)}
            >
              <TabsList aria-label="Breakpoint">
                {available.map((bp) => (
                  <TabsTrigger key={bp} value={bp}>
                    {bp}
                  </TabsTrigger>
                ))}
              </TabsList>
              {available.map((bp) => {
                const layout = draft.layouts.find((l) => l.breakpoint === bp);
                const items = layout?.items ?? [];
                const overlaps = findLayoutOverlaps(items);
                return (
                  <TabsContent key={bp} value={bp} className="grid gap-3 pt-3">
                    {items.length === 0 ? (
                      <EmptyState
                        title="No blocks on this breakpoint"
                        description="Add boards, KPIs, maps, quick actions and links once the block palette is connected."
                      />
                    ) : (
                      <GridEditor
                        items={items}
                        selectedId={selectedId}
                        hiddenByServer={hiddenByServer}
                        onSelect={setSelectedId}
                        onChange={(blockId, next) => patchItem(blockId, clampLayoutItem(next))}
                      />
                    )}
                    {overlaps.length > 0 ? (
                      <ul aria-label="Layout overlaps" className="grid gap-1">
                        {overlaps.map(([a, b]) => (
                          <li
                            key={`${a}-${b}`}
                            className="flex items-start gap-1.5 text-sm font-medium text-critical"
                          >
                            <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                            Blocks {a} and {b} overlap.
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </Panel>
        <div className="grid gap-(--argus-gap)">
          <Panel
            title="Selected block (numeric)"
            description="The same placement as numbers, for precise or keyboard-only editing."
          >
            {(() => {
              const items = draft.layouts.find((l) => l.breakpoint === breakpoint)?.items ?? [];
              const selected = items.find((i) => i.blockId === selectedId);
              return selected ? (
                <BlockNumbers
                  item={selected}
                  onChange={(next) => patchItem(selected.blockId, next)}
                />
              ) : (
                <p className="text-base text-fg-muted">
                  Select a block in the grid to edit it here.
                </p>
              );
            })()}
          </Panel>
          <Panel title="Position preview" bodyClassName="grid gap-3">
            <PositionSelect
              positions={positions}
              value={previewPosition}
              onChange={setPreviewPosition}
            />
            {previewPosition === null ? (
              <p className="text-base text-fg-muted">
                Choose a position to preview what it can see.
              </p>
            ) : preview.isError ? (
              <ErrorState
                title="Server policy preview unavailable"
                error={preview.error}
                onRetry={() => void preview.refetch()}
                size="inline"
              />
            ) : preview.data ? (
              <DecisionList result={preview.data} />
            ) : (
              <p role="status" className="text-base text-fg-muted">
                Evaluating server policy…
              </p>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Position homepages admin (/admin/positions): pick a position homepage layout, edit block
 * placement on a visual grid (with a numeric fallback), and preview server-authoritative visibility.
 */
export function PositionHomepagesScreen(): ReactElement {
  const homepages = useHomepages();
  const positionsQuery = usePositions();
  const [selected, setSelected] = useState<string | null>(null);
  const shell = {
    title: "Position homepages",
    description: "Boards, KPIs, maps, actions and links laid out per position.",
  };
  return (
    <QueryGate
      query={positionsQuery}
      noun="positions"
      {...shell}
      emptyDescription="No positions exist, so no homepage can be assigned."
    >
      {(positions) => (
        <QueryGate
          query={homepages}
          noun="homepages"
          {...shell}
          emptyDescription="No position homepage layouts exist yet."
        >
          {(layouts) => {
            const current = layouts.find((l) => l.id === selected) ?? layouts[0];
            if (!current) {
              return (
                <PageContainer>
                  <PageHeader {...shell} />
                  <EmptyState
                    size="page"
                    title="No homepages yet"
                    description="Position homepages are created through the layout API (TODO(implementation))."
                  />
                </PageContainer>
              );
            }
            return (
              <HomepageEditor
                key={current.id}
                homepage={current}
                position={positions.find((p) => p.id === current.positionId)}
                positions={positions}
                picker={
                  <Panel title="Homepage">
                    <Field label="Choose a homepage" className="max-w-md">
                      <Select
                        value={current.id}
                        onValueChange={setSelected}
                        options={layouts.map((layout) => ({
                          value: layout.id,
                          label: `${layout.name} — ${positions.find((p) => p.id === layout.positionId)?.name ?? "no position"}`,
                        }))}
                      />
                    </Field>
                  </Panel>
                }
              />
            );
          }}
        </QueryGate>
      )}
    </QueryGate>
  );
}
