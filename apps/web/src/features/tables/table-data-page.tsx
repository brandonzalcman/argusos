import type {
  FieldDefinition,
  RecordEnvelope,
  UpdateRecordInput,
  ViewDefinition,
} from "@argus/schema";
import {
  Button,
  Card,
  ConflictBanner,
  EmptyState,
  Kbd,
  NewRowsIndicator,
  PageContainer,
  PageHeader,
  Panel,
  StatusPill,
} from "@argus/ui";
import { ListChecks, Pencil, Undo2 } from "@argus/ui/icons";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useCallback, useMemo, useRef, useState } from "react";
import { BulkEditDialog, PasteDialog } from "./batch-dialogs.js";
import {
  chunk,
  isBulkEditable,
  type PastedCell,
  type PastePlan,
  type PlannedUpdate,
  planPaste,
  pushUndo,
  toUpdateInputs,
  type UndoEdit,
  type UndoEntry,
} from "./batch-model.js";
import { useOptionalToast, useRowDensity } from "./controls.js";
import { DataGrid, type PendingEditState, type PendingEdits } from "./data-grid.js";
import {
  buildDisplayRows,
  emptyViewState,
  filterRecords,
  formatCellValue,
  type GridViewState,
  sortRecords,
  visibleFields,
} from "./grid-model.js";
import { LoadError, LoadingSkeleton, SyncBadge } from "./states.js";
import { type UpdateRecordResult, updateRecordsCompat, useTablesData } from "./tables-port.js";
import { useLiveRows, useSavedViews, useTableDefinition } from "./use-live.js";
import { type SaveViewStatus, ViewToolbar } from "./view-toolbar.js";

interface ConflictState {
  readonly record: RecordEnvelope;
  readonly currentVersion: number;
  readonly localValues: Readonly<Record<string, unknown>>;
  readonly serverValues: Readonly<Record<string, unknown>>;
  readonly fieldIds: readonly string[];
  readonly more: number;
}

const BATCH_SIZE = 200;

export function viewStateFromDefinition(view: ViewDefinition): GridViewState {
  return {
    filters: view.filters,
    sorts: view.sorts,
    grouping: view.grouping,
    hiddenFieldIds: view.hiddenFieldIds,
    fieldOrder: view.fieldOrder,
  };
}

function sameState(a: GridViewState, b: GridViewState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function recordLabel(record: RecordEnvelope, fields: readonly FieldDefinition[]): string {
  const primary = fields.find((f) => f.type === "text" || f.type === "auto-number");
  const value = primary ? formatCellValue(primary, record.values[primary.key]) : "";
  return value !== "" ? value : `record ${record.id.slice(0, 8)}`;
}

/**
 * Live spreadsheet-style grid for one table.
 * Input: `tableId` route param; scope is bound inside the data port.
 * Output: virtualized grid with sort/nested-filter/group, inline editing for every editable type, row flash on
 * live change, "N new rows", same-field conflict banner, saved views, undo, paste-from-Excel and bulk edit.
 * Errors: loading/empty/error states per subscription; failed edits are announced and rolled back.
 * Depends on: TablesDataPort (Electric row shapes, optimistic updateRecord(s) with baseVersion, views).
 * TODO(implementation): fill-down, CSV/XLSX import dry run, audit timeline, redo, server-side bulk jobs.
 */
export function TableDataPageView({ tableId }: { readonly tableId: string }): ReactElement {
  const port = useTablesData();
  const table = useTableDefinition(tableId);
  const live = useLiveRows(tableId);
  const views = useSavedViews(tableId);
  const density = useRowDensity();
  const toast = useOptionalToast();

  const [viewState, setViewState] = useState<GridViewState>(emptyViewState);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<PendingEdits>(new Map());
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveViewStatus>({ state: "idle" });
  const [undoStack, setUndoStack] = useState<readonly UndoEntry[]>([]);
  const [pastePlan, setPastePlan] = useState<PastePlan | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [batching, setBatching] = useState(false);
  const undoRef = useRef<() => void>(() => undefined);

  const definition = table.value ?? null;
  const allFields = definition?.fields ?? [];
  const readableFields = useMemo(
    () => allFields.filter((f) => f.access.defaultMode !== "hidden"),
    [allFields],
  );
  const fieldsById = useMemo(() => new Map(allFields.map((f) => [f.id, f])), [allFields]);
  const columns = useMemo(() => visibleFields(allFields, viewState), [allFields, viewState]);

  const activeView = views.value?.find((v) => v.id === activeViewId) ?? null;
  const baseline = activeView ? viewStateFromDefinition(activeView) : emptyViewState;
  const dirty = !sameState(viewState, baseline);

  const records = useMemo(() => [...live.state.rows.values()], [live.state.rows]);
  const processed = useMemo(
    () =>
      sortRecords(
        filterRecords(records, viewState.filters, fieldsById),
        viewState.sorts,
        fieldsById,
      ),
    [records, viewState.filters, viewState.sorts, fieldsById],
  );
  const displayRows = useMemo(
    () => buildDisplayRows(processed, viewState.grouping, fieldsById, collapsed),
    [processed, viewState.grouping, fieldsById, collapsed],
  );

  const setPendingEdits = useCallback(
    (inputs: readonly UpdateRecordInput[], state: PendingEditState | null) => {
      setPending((prev) => {
        const next = new Map(prev);
        for (const input of inputs) {
          const inner = new Map(next.get(input.recordId) ?? []);
          for (const [key, value] of Object.entries(input.values)) {
            if (state === null) {
              inner.delete(key);
            } else {
              inner.set(key, { value, state });
            }
          }
          if (inner.size === 0) {
            next.delete(input.recordId);
          } else {
            next.set(input.recordId, inner);
          }
        }
        return next;
      });
    },
    [],
  );

  const showConflict = useCallback(
    (
      record: RecordEnvelope,
      result: Extract<UpdateRecordResult, { status: "conflict" }>,
      more: number,
    ) => {
      const byId = new Map(allFields.map((f) => [f.id, f]));
      const conflicting = result.conflicts.filter((c) => byId.has(c.fieldId));
      const pick = (read: (c: (typeof conflicting)[number]) => unknown): Record<string, unknown> =>
        Object.fromEntries(
          conflicting.flatMap((c) => {
            const f = byId.get(c.fieldId);
            return f ? [[f.key, read(c)]] : [];
          }),
        );
      setConflict({
        record,
        currentVersion: result.currentVersion,
        localValues: pick((c) => c.incomingValue),
        serverValues: pick((c) => c.currentValue),
        fieldIds: conflicting.map((c) => c.fieldId),
        more,
      });
    },
    [allFields],
  );

  /**
   * Sends optimistic updates in order (single record via updateRecord, batches via updateRecords), reconciles
   * results into the live row set, and records what undo needs. Returns the confirmed edits.
   */
  const execute = useCallback(
    async (
      inputs: readonly UpdateRecordInput[],
      previous: readonly Readonly<Record<string, unknown>>[],
    ): Promise<{ confirmed: UndoEdit[]; queued: number; conflicts: number; failed: boolean }> => {
      const outcome = { confirmed: [] as UndoEdit[], queued: 0, conflicts: 0, failed: false };
      setEditError(null);
      let offset = 0;
      for (const group of chunk(inputs, BATCH_SIZE)) {
        setPendingEdits(group, "saving");
        let results: readonly UpdateRecordResult[];
        try {
          results =
            group.length === 1 && group[0]
              ? [await port.updateRecord(group[0])]
              : await updateRecordsCompat(port, group);
        } catch (error) {
          setPendingEdits(group, null);
          setEditError(error instanceof Error ? error.message : "The change could not be saved.");
          outcome.failed = true;
          return outcome;
        }
        let firstConflictShown = false;
        group.forEach((input, i) => {
          const result = results[i];
          const record = live.state.rows.get(input.recordId);
          if (!result) {
            setPendingEdits([input], null);
            return;
          }
          if (result.status === "committed") {
            setPendingEdits([input], null);
            live.commitLocal(result.record);
            outcome.confirmed.push({
              recordId: input.recordId,
              previous: previous[offset + i] ?? {},
              versionAfter: result.record.version,
            });
          } else if (result.status === "queued") {
            setPendingEdits([input], "queued");
            outcome.queued += 1;
          } else {
            setPendingEdits([input], null);
            outcome.conflicts += 1;
            if (record && !firstConflictShown) {
              firstConflictShown = true;
              showConflict(record, result, 0);
            }
          }
        });
        offset += group.length;
      }
      return outcome;
    },
    [live, port, setPendingEdits, showConflict],
  );

  const summarize = useCallback(
    (
      label: string,
      o: { confirmed: UndoEdit[]; queued: number; conflicts: number; failed: boolean },
    ) => {
      if (o.confirmed.length > 0) {
        setUndoStack((s) => pushUndo(s, { label, edits: o.confirmed }));
      }
      const parts = [
        `${o.confirmed.length} saved`,
        ...(o.queued > 0 ? [`${o.queued} queued offline`] : []),
        ...(o.conflicts > 0 ? [`${o.conflicts} need review`] : []),
      ];
      toast?.toast({
        title: label,
        description: parts.join(" · "),
        tone: o.conflicts > 0 || o.failed ? "warning" : "success",
        duration: 6000,
        ...(o.confirmed.length > 0
          ? {
              action: {
                label: "Undo",
                altText: `Undo ${label}`,
                onAction: () => undoRef.current(),
              },
            }
          : {}),
      });
    },
    [toast],
  );

  const applyUpdates = useCallback(
    async (updates: readonly PlannedUpdate[], label: string) => {
      setBatching(true);
      try {
        const outcome = await execute(
          toUpdateInputs(tableId, updates),
          updates.map((u) => u.previous),
        );
        summarize(label, outcome);
      } finally {
        setBatching(false);
      }
    },
    [execute, summarize, tableId],
  );

  const onEdit = useCallback(
    (record: RecordEnvelope, field: FieldDefinition, next: unknown) => {
      void applyUpdates(
        [
          {
            record,
            values: { [field.key]: next },
            previous: { [field.key]: record.values[field.key] ?? null },
          },
        ],
        `Edited ${field.name}`,
      );
    },
    [applyUpdates],
  );

  const undo = useCallback(async () => {
    const entry = undoStack.at(-1);
    if (!entry) {
      return;
    }
    setUndoStack((s) => s.slice(0, -1));
    // Base = the version our edit produced, so anyone else's later change shows up as a conflict.
    const inputs: UpdateRecordInput[] = entry.edits.map((e) => ({
      tableId,
      recordId: e.recordId,
      baseVersion: e.versionAfter,
      values: e.previous,
    }));
    setBatching(true);
    try {
      const outcome = await execute(inputs, []);
      toast?.toast({
        title: `Undid: ${entry.label}`,
        description: `${outcome.confirmed.length} restored${outcome.conflicts > 0 ? ` · ${outcome.conflicts} changed by someone else` : ""}`,
        tone: outcome.conflicts > 0 ? "warning" : "success",
        duration: 5000,
      });
    } finally {
      setBatching(false);
    }
  }, [execute, tableId, toast, undoStack]);
  undoRef.current = () => void undo();

  const onSort = useCallback((fieldId: string, additive: boolean) => {
    setViewState((prev) => {
      const current = prev.sorts.find((s) => s.fieldId === fieldId);
      const others = additive ? prev.sorts.filter((s) => s.fieldId !== fieldId) : [];
      if (!current) {
        return { ...prev, sorts: [...others, { fieldId, direction: "ascending", nulls: "last" }] };
      }
      if (current.direction === "ascending") {
        return { ...prev, sorts: [...others, { ...current, direction: "descending" }] };
      }
      return { ...prev, sorts: others };
    });
  }, []);

  const onSaveView = useCallback(
    async (name: string, mode: "update" | "new") => {
      setSaveStatus({ state: "saving" });
      try {
        const saved = await port.saveView({
          tableId,
          name,
          existing:
            mode === "update" && activeView
              ? { viewId: activeView.id, expectedVersion: activeView.version }
              : null,
          state: viewState,
        });
        setActiveViewId(saved.id);
        setSaveStatus({ state: "saved", name: saved.name });
      } catch (error) {
        setSaveStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [activeView, port, tableId, viewState],
  );

  const onPasteCells = useCallback((cells: readonly PastedCell[], overflow: number) => {
    setPastePlan(planPaste(cells, overflow));
  }, []);

  if (table.status === "loading") {
    return (
      <PageContainer width="wide">
        <LoadingSkeleton label="Loading table" />
      </PageContainer>
    );
  }
  if (table.status === "error") {
    return (
      <PageContainer width="wide">
        <LoadError title="Table could not be loaded" error={table.error} onRetry={table.retry} />
      </PageContainer>
    );
  }
  if (!definition) {
    return (
      <PageContainer width="wide">
        <Card>
          <EmptyState
            size="page"
            title="Table not available"
            description="This table does not exist or your position cannot read it."
            action={
              <Button asChild variant="secondary">
                <Link to="/tables">Back to tables</Link>
              </Button>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  const rowHeight = density === "compact" ? 30 : 40;
  const lastUndo = undoStack.at(-1);
  const countLabel =
    processed.length === records.length
      ? `${records.length.toLocaleString()} rows`
      : `${processed.length.toLocaleString()} of ${records.length.toLocaleString()} rows match`;

  return (
    <PageContainer width="full">
      <PageHeader
        eyebrow="Table"
        title={definition.name}
        description={definition.description ?? "Live rows with inline editing and saved views."}
        breadcrumbs={[
          { label: "Tables", link: <Link to="/tables">Tables</Link> },
          { label: definition.name },
        ]}
        meta={
          <>
            <SyncBadge sync={live.sync ?? table.sync} />
            <StatusPill
              status="info"
              label={definition.incidentScope === "incident" ? "Incident-scoped" : "Global"}
              size="sm"
            />
            <span className="font-mono text-xs text-fg-muted">
              definition v{definition.version}
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Undo2 />}
              disabled={!lastUndo || batching}
              onClick={() => void undo()}
              title={lastUndo ? `Undo: ${lastUndo.label}` : "Nothing to undo"}
            >
              Undo <Kbd>Ctrl Z</Kbd>
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<ListChecks />}
              disabled={live.status !== "ready" || processed.length === 0}
              onClick={() => setBulkOpen(true)}
            >
              Bulk edit
            </Button>
            <Button asChild variant="secondary" leadingIcon={<Pencil />}>
              <Link to="/tables/$tableId/design" params={{ tableId }}>
                Design table
              </Link>
            </Button>
          </>
        }
      />

      <ViewToolbar
        fields={readableFields}
        state={viewState}
        onChange={setViewState}
        views={views.value ?? []}
        viewsLoading={views.status === "loading"}
        activeViewId={activeViewId}
        dirty={dirty}
        onSelectView={(id) => {
          setActiveViewId(id);
          const next = views.value?.find((v) => v.id === id);
          setViewState(next ? viewStateFromDefinition(next) : emptyViewState);
          setCollapsed(new Set());
        }}
        onSaveView={(name, mode) => void onSaveView(name, mode)}
        saveStatus={saveStatus}
      />
      {views.status === "error" ? (
        <p role="alert" className="text-sm text-critical">
          Saved views are unavailable: {views.error?.message}
        </p>
      ) : null}

      {conflict ? (
        <ConflictBanner
          recordLabel={recordLabel(conflict.record, allFields)}
          fields={conflict.fieldIds.flatMap((id) => {
            const f = fieldsById.get(id);
            return f
              ? [
                  {
                    fieldId: id,
                    fieldLabel: f.name,
                    localValue: formatCellValue(f, conflict.localValues[f.key]),
                    serverValue: formatCellValue(f, conflict.serverValues[f.key]),
                  },
                ]
              : [];
          })}
          onKeepMine={() => {
            const c = conflict;
            setConflict(null);
            void applyUpdates(
              [
                {
                  record: { ...c.record, version: c.currentVersion },
                  values: c.localValues,
                  previous: c.serverValues,
                },
              ],
              "Kept your change",
            );
          }}
          onKeepTheirs={() => setConflict(null)}
        />
      ) : null}
      {editError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md border border-critical bg-critical-subtle p-3 text-sm"
        >
          <span>Change not saved: {editError}</span>
          <Button size="sm" variant="secondary" onClick={() => setEditError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {live.status === "loading" ? <LoadingSkeleton label="Loading rows" rows={8} /> : null}
      {live.status === "error" ? (
        <LoadError title="Rows could not be loaded" error={live.error} onRetry={live.retry} />
      ) : null}
      {live.status === "ready" ? (
        <Panel
          title="Rows"
          flush
          status={
            <span role="status" className="font-mono text-sm text-fg-muted">
              {countLabel}
            </span>
          }
          actions={
            <NewRowsIndicator count={live.pendingCount} onShowNewRows={live.revealPending} />
          }
        >
          {records.length === 0 ? (
            <EmptyState
              title="No rows yet"
              description="New rows appear here live as they are created."
            />
          ) : processed.length === 0 ? (
            <EmptyState
              title="No rows match this view"
              description="Loosen or clear the filters to see rows again."
              action={
                <Button
                  variant="secondary"
                  onClick={() => setViewState({ ...viewState, filters: null })}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <DataGrid
              caption={`${definition.name} rows`}
              tableId={tableId}
              fields={columns}
              rows={displayRows}
              pendingEdits={pending}
              sorts={viewState.sorts}
              rowHeight={rowHeight}
              onSort={onSort}
              onEdit={onEdit}
              onPasteCells={onPasteCells}
              onUndo={() => void undo()}
              onToggleGroup={(key) =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(key)) {
                    next.add(key);
                  }
                  return next;
                })
              }
            />
          )}
        </Panel>
      ) : null}

      <PasteDialog
        plan={pastePlan}
        applying={batching}
        recordLabel={(id) => {
          const r = live.state.rows.get(id);
          return r ? recordLabel(r, allFields) : `record ${id.slice(0, 8)}`;
        }}
        onCancel={() => setPastePlan(null)}
        onConfirm={(updates) => {
          void applyUpdates(updates, `Pasted into ${updates.length} rows`).then(() =>
            setPastePlan(null),
          );
        }}
      />
      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        fields={readableFields.filter(isBulkEditable)}
        records={processed}
        applying={batching}
        onConfirm={(updates, label) => {
          void applyUpdates(updates, label).then(() => setBulkOpen(false));
        }}
      />
    </PageContainer>
  );
}

/** Route component: reads `$tableId` from the router and renders the live grid. */
export function TableDataPageRoute(): ReactElement {
  const { tableId } = useParams({ strict: false });
  if (!tableId) {
    return (
      <PageContainer>
        <EmptyState size="page" title="No table selected" />
      </PageContainer>
    );
  }
  return <TableDataPageView key={tableId} tableId={tableId} />;
}
