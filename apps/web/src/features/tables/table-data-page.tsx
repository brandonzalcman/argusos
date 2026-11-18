import type { FieldDefinition, RecordEnvelope, ViewDefinition } from "@argus/schema";
import { ConflictBanner, type Density, DensityControl, NewRowsIndicator } from "@argus/ui";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useCallback, useId, useMemo, useState } from "react";
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
import { EmptyState, ErrorState, LoadingSkeleton, SyncBadge } from "./states.js";
import { type UpdateRecordResult, useTablesData } from "./tables-port.js";
import { useLiveRows, useSavedViews, useTableDefinition } from "./use-live.js";
import { type SaveViewStatus, ViewToolbar } from "./view-toolbar.js";
import "./tables.css";

interface ConflictState {
  readonly record: RecordEnvelope;
  readonly currentVersion: number;
  readonly localValues: Readonly<Record<string, unknown>>;
  readonly serverValues: Readonly<Record<string, unknown>>;
  readonly fieldIds: readonly string[];
}

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
 * Output: virtualized grid with sort/filter/group, inline editing, row flash on live change, "N new rows",
 * a same-field conflict banner and saved views.
 * Errors: loading/empty/error states per subscription; failed edits are announced and rolled back.
 * Depends on: TablesDataPort (Electric row shapes, optimistic updateRecord with baseVersion, views).
 * TODO(implementation): bulk edit, fill-down, paste from Excel, undo, import dry run and audit timeline.
 */
export function TableDataPageView({ tableId }: { readonly tableId: string }): ReactElement {
  const port = useTablesData();
  const table = useTableDefinition(tableId);
  const live = useLiveRows(tableId);
  const views = useSavedViews(tableId);
  const headingId = useId();

  const [viewState, setViewState] = useState<GridViewState>(emptyViewState);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [density, setDensity] = useState<Density>("comfortable");
  const [pending, setPending] = useState<PendingEdits>(new Map());
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveViewStatus>({ state: "idle" });

  const definition = table.value ?? null;
  const allFields = definition?.fields ?? [];
  const fieldsById = useMemo(() => new Map(allFields.map((f) => [f.id, f])), [allFields]);
  const columns = useMemo(() => visibleFields(allFields, viewState), [allFields, viewState]);

  const activeView = views.value?.find((v) => v.id === activeViewId) ?? null;
  const baseline = activeView ? viewStateFromDefinition(activeView) : emptyViewState;
  const dirty = !sameState(viewState, baseline);

  const records = useMemo(() => [...live.state.rows.values()], [live.state.rows]);
  const processed = useMemo(() => {
    const filtered = filterRecords(records, viewState.filters, fieldsById);
    return sortRecords(filtered, viewState.sorts, fieldsById);
  }, [records, viewState.filters, viewState.sorts, fieldsById]);
  const displayRows = useMemo(
    () => buildDisplayRows(processed, viewState.grouping, fieldsById, collapsed),
    [processed, viewState.grouping, fieldsById, collapsed],
  );

  const setPendingEdit = useCallback(
    (recordId: string, key: string, value: unknown, state: PendingEditState | null) => {
      setPending((prev) => {
        const next = new Map(prev);
        const inner = new Map(next.get(recordId) ?? []);
        if (state === null) {
          inner.delete(key);
        } else {
          inner.set(key, { value, state });
        }
        if (inner.size === 0) {
          next.delete(recordId);
        } else {
          next.set(recordId, inner);
        }
        return next;
      });
    },
    [],
  );

  const handleResult = useCallback(
    (
      result: UpdateRecordResult,
      record: RecordEnvelope,
      values: Readonly<Record<string, unknown>>,
    ) => {
      const keys = Object.keys(values);
      if (result.status === "committed") {
        for (const k of keys) {
          setPendingEdit(record.id, k, undefined, null);
        }
        live.commitLocal(result.record);
        setConflict(null);
      } else if (result.status === "queued") {
        for (const k of keys) {
          setPendingEdit(record.id, k, values[k], "queued");
        }
      } else {
        for (const k of keys) {
          setPendingEdit(record.id, k, undefined, null);
        }
        const byId = new Map(allFields.map((f) => [f.id, f]));
        const conflicting = result.conflicts.filter((c) => byId.has(c.fieldId));
        setConflict({
          record,
          currentVersion: result.currentVersion,
          localValues: Object.fromEntries(
            conflicting.flatMap((c) => {
              const f = byId.get(c.fieldId);
              return f ? [[f.key, c.incomingValue]] : [];
            }),
          ),
          serverValues: Object.fromEntries(
            conflicting.flatMap((c) => {
              const f = byId.get(c.fieldId);
              return f ? [[f.key, c.currentValue]] : [];
            }),
          ),
          fieldIds: conflicting.map((c) => c.fieldId),
        });
      }
    },
    [allFields, live, setPendingEdit],
  );

  const submit = useCallback(
    async (
      record: RecordEnvelope,
      values: Readonly<Record<string, unknown>>,
      baseVersion: number,
    ) => {
      setEditError(null);
      for (const [k, v] of Object.entries(values)) {
        setPendingEdit(record.id, k, v, "saving");
      }
      try {
        const result = await port.updateRecord({
          tableId,
          recordId: record.id,
          baseVersion,
          values,
        });
        handleResult(result, record, values);
      } catch (error) {
        for (const k of Object.keys(values)) {
          setPendingEdit(record.id, k, undefined, null);
        }
        setEditError(error instanceof Error ? error.message : "The change could not be saved.");
      }
    },
    [handleResult, port, setPendingEdit, tableId],
  );

  const onEdit = useCallback(
    (record: RecordEnvelope, field: FieldDefinition, next: unknown) => {
      void submit(record, { [field.key]: next }, record.version);
    },
    [submit],
  );

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

  if (table.status === "loading") {
    return <LoadingSkeleton label="Loading table" />;
  }
  if (table.status === "error") {
    return (
      <ErrorState title="Table could not be loaded" error={table.error} onRetry={table.retry} />
    );
  }
  if (!definition) {
    return (
      <EmptyState title="Table not available">
        <p>This table does not exist or your position cannot read it.</p>
        <Link to="/tables">Back to tables</Link>
      </EmptyState>
    );
  }

  const rowHeight = density === "compact" ? 28 : 38;

  return (
    <article className="argus-stack" aria-labelledby={headingId}>
      <header className="tbl-header">
        <div>
          <h1 id={headingId}>{definition.name}</h1>
          <p className="argus-muted">
            {definition.incidentScope === "incident" ? "Incident-scoped" : "Global"} table ·{" "}
            <span className="tbl-mono">definition v{definition.version}</span>
          </p>
        </div>
        <div className="argus-cluster">
          <SyncBadge sync={live.sync ?? table.sync} />
          <Link to="/tables/$tableId/design" params={{ tableId }}>
            Design table
          </Link>
          <DensityControl value={density} onChange={setDensity} />
        </div>
      </header>

      <ViewToolbar
        fields={allFields.filter((f) => f.access.defaultMode !== "hidden")}
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
        <p role="alert">Saved views are unavailable: {views.error?.message}</p>
      ) : null}

      {conflict ? (
        <div className="argus-stack">
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
          />
          <div className="argus-cluster">
            <button
              type="button"
              className="tbl-button"
              onClick={() => {
                const c = conflict;
                setConflict(null);
                void submit(c.record, c.localValues, c.currentVersion);
              }}
            >
              Keep mine
            </button>
            <button type="button" className="tbl-button" onClick={() => setConflict(null)}>
              Keep theirs
            </button>
          </div>
        </div>
      ) : null}
      {editError ? (
        <p role="alert" className="tbl-error-text">
          Change not saved: {editError}{" "}
          <button type="button" className="tbl-button" onClick={() => setEditError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {live.status === "loading" ? <LoadingSkeleton label="Loading rows" /> : null}
      {live.status === "error" ? (
        <ErrorState title="Rows could not be loaded" error={live.error} onRetry={live.retry} />
      ) : null}
      {live.status === "ready" ? (
        <>
          <div className="argus-cluster tbl-statusline">
            <span role="status">
              {processed.length === records.length
                ? `${records.length.toLocaleString()} rows`
                : `${processed.length.toLocaleString()} of ${records.length.toLocaleString()} rows match`}
            </span>
            <NewRowsIndicator count={live.pendingCount} onShowNewRows={live.revealPending} />
          </div>
          {records.length === 0 ? (
            <EmptyState title="No rows yet">
              <p>New rows appear here live as they are created.</p>
              {/* TODO(implementation): "Add row" and CSV/XLSX import with dry run. */}
            </EmptyState>
          ) : processed.length === 0 ? (
            <EmptyState title="No rows match this view">
              <button
                type="button"
                className="tbl-button"
                onClick={() => setViewState({ ...viewState, filters: null })}
              >
                Clear filters
              </button>
            </EmptyState>
          ) : (
            <DataGrid
              caption={`${definition.name} rows`}
              fields={columns}
              rows={displayRows}
              flashes={live.state.flashes}
              pendingEdits={pending}
              sorts={viewState.sorts}
              rowHeight={rowHeight}
              onSort={onSort}
              onEdit={onEdit}
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
        </>
      ) : null}
    </article>
  );
}

/** Route component: reads `$tableId` from the router and renders the live grid. */
export function TableDataPageRoute(): ReactElement {
  const { tableId } = useParams({ strict: false });
  if (!tableId) {
    return <EmptyState title="No table selected" />;
  }
  return <TableDataPageView key={tableId} tableId={tableId} />;
}
