import type { MigrationExecutionResult, MigrationPreview } from "@argus/ddl-engine";
import type { FieldDefinition, TableDefinition } from "@argus/schema";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useId, useMemo, useState } from "react";
import {
  createDraftField,
  describeDraftChanges,
  type RelationTarget,
  validateDraft,
} from "./designer-model.js";
import { fieldTypeLabel, listFieldTypes } from "./field-catalog.js";
import { FieldEditor } from "./field-editor.js";
import { MigrationPreviewPanel } from "./migration-preview.js";
import { EmptyState, ErrorState, LoadingSkeleton, SyncBadge } from "./states.js";
import { useTablesData } from "./tables-port.js";
import { useTableCatalog, useTableDefinition } from "./use-live.js";
import "./tables.css";

const TYPE_OPTIONS = listFieldTypes().map((p) => ({
  id: p.id,
  label: p.metadata.displayName,
}));

type Selection = { readonly fieldId: string; readonly isNew: boolean } | null;

type PreviewState =
  | { readonly state: "none" }
  | { readonly state: "planning" }
  | { readonly state: "ready"; readonly preview: MigrationPreview; readonly fingerprint: string }
  | { readonly state: "error"; readonly message: string };

type ApplyState =
  | { readonly state: "idle" }
  | { readonly state: "applying" }
  | { readonly state: "done"; readonly result: MigrationExecutionResult }
  | { readonly state: "error"; readonly message: string };

function fingerprint(fields: readonly FieldDefinition[]): string {
  return JSON.stringify(fields);
}

/**
 * Designer for one table. Edits are local drafts; the DDL engine plans them and only an explicit,
 * digest-bound confirmation applies them.
 * Input: a published TableDefinition (live subscription) and the authorized catalog for relations.
 * Output: field list, add/edit form, plan preview and apply step.
 * Errors: stale live version (someone published meanwhile) blocks apply and asks to reload.
 * Depends on: TablesDataPort.previewMigration/applyMigration over @argus/ddl-engine.
 */
function Designer({
  table,
  catalog,
}: {
  readonly table: TableDefinition;
  readonly catalog: readonly TableDefinition[];
}): ReactElement {
  const port = useTablesData();
  const headingId = useId();
  const [draft, setDraft] = useState<readonly FieldDefinition[]>(table.fields);
  const [baseVersion, setBaseVersion] = useState(table.version);
  const [selection, setSelection] = useState<Selection>(null);
  const [preview, setPreview] = useState<PreviewState>({ state: "none" });
  const [apply, setApply] = useState<ApplyState>({ state: "idle" });
  const [newType, setNewType] = useState("text");

  const stale = table.version !== baseVersion;
  const liveIds = useMemo(() => new Set(table.fields.map((f) => f.id)), [table.fields]);
  const changes = useMemo(() => describeDraftChanges(table.fields, draft), [table.fields, draft]);
  const relations = useMemo(() => {
    const map = new Map<string, RelationTarget>();
    for (const t of catalog) {
      map.set(t.id, { tableId: t.id, fields: t.fields });
    }
    return map;
  }, [catalog]);
  const issues = useMemo(() => validateDraft(draft, relations), [draft, relations]);
  const issuesFor = (id: string): string[] =>
    issues.filter((i) => i.fieldId === id).map((i) => i.message);
  const selected = draft.find((f) => f.id === selection?.fieldId) ?? null;
  const currentFingerprint = useMemo(() => fingerprint(draft), [draft]);
  const previewIsCurrent = preview.state === "ready" && preview.fingerprint === currentFingerprint;

  const edit = (next: readonly FieldDefinition[]): void => {
    setDraft(next);
    setApply({ state: "idle" });
    setPreview((p) => (p.state === "ready" ? { state: "none" } : p));
  };

  const addField = (): void => {
    const keys = new Set(draft.map((f) => f.key));
    const field = createDraftField(
      newType as FieldDefinition["type"],
      `New ${fieldTypeLabel(newType).toLocaleLowerCase()} field`,
      keys,
    );
    edit([...draft, field]);
    setSelection({ fieldId: field.id, isNew: true });
  };

  const requestPreview = async (): Promise<void> => {
    setPreview({ state: "planning" });
    setApply({ state: "idle" });
    try {
      const result = await port.previewMigration({
        tableId: table.id,
        expectedLiveVersion: table.version,
        fields: draft,
      });
      setBaseVersion(table.version);
      setPreview({ state: "ready", preview: result, fingerprint: currentFingerprint });
    } catch (error) {
      setPreview({
        state: "error",
        message: error instanceof Error ? error.message : "The plan could not be created.",
      });
    }
  };

  const runApply = async (acknowledged: readonly string[]): Promise<void> => {
    if (preview.state !== "ready") {
      return;
    }
    const { plan } = preview.preview;
    setApply({ state: "applying" });
    try {
      const result = await port.applyMigration({
        tableId: table.id,
        planId: plan.planId,
        planDigest: plan.planDigest,
        expectedLiveVersion: table.version,
        acknowledgedDestructiveOperationIds: acknowledged,
      });
      setApply({ state: "done", result });
      setBaseVersion(result.publishedVersion);
      setPreview({ state: "none" });
    } catch (error) {
      setApply({
        state: "error",
        message: error instanceof Error ? error.message : "The change could not be applied.",
      });
    }
  };

  return (
    <article className="argus-stack" aria-labelledby={headingId}>
      <header className="tbl-header">
        <div>
          <h1 id={headingId}>Design: {table.name}</h1>
          <p className="argus-muted">
            Published version <span className="tbl-mono">{table.version}</span> ·{" "}
            {table.incidentScope === "incident" ? "Incident-scoped" : "Global"}
          </p>
        </div>
        <div className="argus-cluster">
          <Link to="/tables/$tableId" params={{ tableId: table.id }}>
            Back to data
          </Link>
        </div>
      </header>

      {stale ? (
        <p role="alert" className="tbl-error-text">
          This table was published by someone else while you were editing (now v{table.version}).
          Preview again so the plan is built against the current version.
        </p>
      ) : null}

      <div className="tbl-designer">
        <section className="argus-panel argus-stack" aria-label="Fields">
          <div className="tbl-header">
            <h2>Fields ({draft.length})</h2>
            <div className="argus-cluster">
              <label>
                <span className="tbl-sr-only">New field type</span>
                <select
                  className="tbl-input"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="tbl-button tbl-button--primary" onClick={addField}>
                Add field
              </button>
            </div>
          </div>
          {draft.length === 0 ? (
            <p className="argus-muted">No fields yet. Add the first one.</p>
          ) : (
            <ul className="tbl-field-list">
              {draft.map((f, index) => {
                const isNew = !liveIds.has(f.id);
                const fieldIssues = issuesFor(f.id);
                return (
                  <li key={f.id} data-selected={selection?.fieldId === f.id || undefined}>
                    <button
                      type="button"
                      className="tbl-field-button"
                      aria-pressed={selection?.fieldId === f.id}
                      onClick={() => setSelection({ fieldId: f.id, isNew })}
                    >
                      <strong>{f.name || "(unnamed)"}</strong>{" "}
                      <span className="argus-muted">{fieldTypeLabel(f.type)}</span>
                      {isNew ? <span className="tbl-tag"> New</span> : null}
                      {f.required ? <span className="tbl-tag"> Required</span> : null}
                      {f.unique ? <span className="tbl-tag"> Unique</span> : null}
                      {f.access.defaultMode === "hidden" ? (
                        <span className="tbl-tag"> Hidden</span>
                      ) : null}
                      {fieldIssues.length > 0 ? (
                        <span className="tbl-tag tbl-tag--danger">
                          {" "}
                          {fieldIssues.length} issue{fieldIssues.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </button>
                    <span className="argus-cluster">
                      <button
                        type="button"
                        className="tbl-button"
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...draft];
                          const [moved] = next.splice(index, 1);
                          if (moved) {
                            next.splice(index - 1, 0, moved);
                          }
                          edit(next);
                        }}
                      >
                        Move {f.name || "field"} up
                      </button>
                      <button
                        type="button"
                        className="tbl-button"
                        onClick={() => {
                          edit(draft.filter((d) => d.id !== f.id));
                          if (selection?.fieldId === f.id) {
                            setSelection(null);
                          }
                        }}
                      >
                        Remove {f.name || "field"}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {table.fields.some((f) => !draft.some((d) => d.id === f.id)) ? (
            <div className="argus-stack">
              <h3>Removed in this draft</h3>
              <ul>
                {table.fields
                  .filter((f) => !draft.some((d) => d.id === f.id))
                  .map((f) => (
                    <li key={f.id} className="argus-cluster">
                      <span>{f.name}</span>
                      <button
                        type="button"
                        className="tbl-button"
                        onClick={() => edit([...draft, f])}
                      >
                        Restore {f.name}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="argus-panel" aria-label="Field settings">
          {selected && selection ? (
            <>
              <h2>{selection.isNew ? "New field" : `Edit ${selected.name}`}</h2>
              <FieldEditor
                field={selected}
                isNew={selection.isNew}
                draftFields={draft}
                tables={catalog}
                issues={issuesFor(selected.id)}
                onChange={(next) => edit(draft.map((f) => (f.id === next.id ? next : f)))}
              />
            </>
          ) : (
            <p className="argus-muted">Select a field to edit it, or add a new one.</p>
          )}
        </section>
      </div>

      <section className="argus-panel argus-stack" aria-label="Draft changes">
        <h2>Draft changes</h2>
        {changes.length === 0 ? (
          <p className="argus-muted">No unsaved changes.</p>
        ) : (
          <ul>
            {changes.map((c) => (
              <li key={`${c.fieldId}:${c.kind}`}>{c.description}</li>
            ))}
          </ul>
        )}
        {issues.length > 0 ? (
          <p role="alert">
            Fix {issues.length} field issue{issues.length === 1 ? "" : "s"} before previewing.
          </p>
        ) : null}
        <div className="argus-cluster">
          <button
            type="button"
            className="tbl-button tbl-button--primary"
            disabled={changes.length === 0 || issues.length > 0 || preview.state === "planning"}
            onClick={() => void requestPreview()}
          >
            {preview.state === "planning" ? "Planning…" : "Preview schema change"}
          </button>
          <button
            type="button"
            className="tbl-button"
            disabled={changes.length === 0}
            onClick={() => {
              edit(table.fields);
              setSelection(null);
            }}
          >
            Discard draft
          </button>
        </div>
        {preview.state === "error" ? (
          <p role="alert">Could not plan this change: {preview.message}</p>
        ) : null}
      </section>

      {preview.state === "ready" ? (
        previewIsCurrent && !stale ? (
          <MigrationPreviewPanel
            preview={preview.preview}
            tableName={table.name}
            applying={apply.state === "applying"}
            onApply={(ids) => void runApply(ids)}
            onDiscard={() => setPreview({ state: "none" })}
          />
        ) : (
          <p role="alert">The draft changed after this plan was created. Preview again.</p>
        )
      ) : null}
      {apply.state === "error" ? (
        <p role="alert" className="tbl-error-text">
          Not applied: {apply.message}
        </p>
      ) : null}
      {apply.state === "done" ? (
        <p role="status">
          Published version <span className="tbl-mono">{apply.result.publishedVersion}</span> at{" "}
          {new Date(apply.result.committedAt).toLocaleString(undefined, { timeZoneName: "short" })}.
          Audit event <span className="tbl-mono">{apply.result.auditEventId}</span>.
        </p>
      ) : null}
    </article>
  );
}

/** Route view with loading / not-found / error states around the designer. */
export function TableDesignerPageView({ tableId }: { readonly tableId: string }): ReactElement {
  const table = useTableDefinition(tableId);
  const catalog = useTableCatalog();

  if (table.status === "loading" || catalog.status === "loading") {
    return <LoadingSkeleton label="Loading table definition" />;
  }
  if (table.status === "error" || catalog.status === "error") {
    const failed = table.status === "error" ? table : catalog;
    return (
      <ErrorState
        title="Table definition could not be loaded"
        error={failed.error}
        onRetry={() => {
          table.retry();
          catalog.retry();
        }}
      />
    );
  }
  if (!table.value) {
    return (
      <EmptyState title="Table not available">
        <p>This table does not exist or your position may not design it.</p>
        <Link to="/tables">Back to tables</Link>
      </EmptyState>
    );
  }
  return (
    <>
      <SyncBadge sync={table.sync} />
      <Designer table={table.value} catalog={catalog.value ?? []} />
    </>
  );
}

export function TableDesignerPageRoute(): ReactElement {
  const { tableId } = useParams({ strict: false });
  if (!tableId) {
    return <EmptyState title="No table selected" />;
  }
  return <TableDesignerPageView key={tableId} tableId={tableId} />;
}
