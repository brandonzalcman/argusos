import type { MigrationExecutionResult, MigrationPreview } from "@argus/ddl-engine";
import type { FieldDefinition, FieldTypeId, TableDefinition } from "@argus/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageContainer,
  PageHeader,
  Panel,
  StatusPill,
} from "@argus/ui";
import { ArrowLeft, ArrowUp, Plus, RotateCcw, Trash2 } from "@argus/ui/icons";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useMemo, useState } from "react";
import { NativeSelect } from "./controls.js";
import {
  createDraftField,
  describeDraftChanges,
  type RelationTarget,
  validateDraft,
} from "./designer-model.js";
import { fieldTypeLabel, listFieldTypes } from "./field-catalog.js";
import { FieldEditor } from "./field-editor.js";
import { MigrationPreviewPanel } from "./migration-preview.js";
import { LoadError, LoadingSkeleton, SyncBadge } from "./states.js";
import { useTablesData } from "./tables-port.js";
import { useTableCatalog, useTableDefinition } from "./use-live.js";

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
 * Output: field list, add/edit form, plan preview and apply dialog.
 * Errors: stale live version (someone published meanwhile) blocks apply and asks to preview again.
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
  const [draft, setDraft] = useState<readonly FieldDefinition[]>(table.fields);
  const [baseVersion, setBaseVersion] = useState(table.version);
  const [selection, setSelection] = useState<Selection>(null);
  const [preview, setPreview] = useState<PreviewState>({ state: "none" });
  const [apply, setApply] = useState<ApplyState>({ state: "idle" });
  const [newType, setNewType] = useState<FieldTypeId>("text");

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
  const removed = table.fields.filter((f) => !draft.some((d) => d.id === f.id));

  const edit = (next: readonly FieldDefinition[]): void => {
    setDraft(next);
    setApply({ state: "idle" });
    setPreview((p) => (p.state === "ready" ? { state: "none" } : p));
  };

  const addField = (): void => {
    const keys = new Set(draft.map((f) => f.key));
    const field = createDraftField(
      newType,
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
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Table designer"
        title={`Design: ${table.name}`}
        description="Edit fields locally, preview the migration plan, then apply with confirmation."
        breadcrumbs={[
          { label: "Tables", link: <Link to="/tables">Tables</Link> },
          {
            label: table.name,
            link: (
              <Link to="/tables/$tableId" params={{ tableId: table.id }}>
                {table.name}
              </Link>
            ),
          },
          { label: "Design" },
        ]}
        meta={
          <>
            <StatusPill status="ok" label={`Published v${table.version}`} size="sm" />
            <Badge tone={table.incidentScope === "incident" ? "accent" : "neutral"}>
              {table.incidentScope === "incident" ? "Incident-scoped" : "Global"}
            </Badge>
          </>
        }
        actions={
          <Button asChild variant="secondary" leadingIcon={<ArrowLeft />}>
            <Link to="/tables/$tableId" params={{ tableId: table.id }}>
              Back to data
            </Link>
          </Button>
        }
      />

      {stale ? (
        <p
          role="alert"
          className="rounded-md border border-warning-solid bg-warning-subtle p-3 text-sm"
        >
          This table was published by someone else while you were editing (now v{table.version}).
          Preview again so the plan is built against the current version.
        </p>
      ) : null}

      <div className="grid items-start gap-(--argus-gap) lg:grid-cols-[minmax(20rem,1fr)_minmax(22rem,1.2fr)]">
        <Panel
          title={`Fields (${draft.length})`}
          actions={
            <>
              <NativeSelect
                aria-label="New field type"
                className="w-40"
                value={newType}
                onChange={(e) => setNewType(e.target.value as FieldTypeId)}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
              <Button variant="primary" size="sm" leadingIcon={<Plus />} onClick={addField}>
                Add field
              </Button>
            </>
          }
        >
          {draft.length === 0 ? (
            <EmptyState
              title="No fields yet"
              description="Add the first field to give this table its shape."
            />
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {draft.map((f, index) => {
                const isNew = !liveIds.has(f.id);
                const fieldIssues = issuesFor(f.id);
                const isSelected = selection?.fieldId === f.id;
                return (
                  <li
                    key={f.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${
                      isSelected ? "border-focus bg-accent-subtle" : "border-border bg-surface"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      className="min-w-40 flex-1 rounded-sm text-start focus-visible:outline-2 focus-visible:outline-focus"
                      onClick={() => setSelection({ fieldId: f.id, isNew })}
                    >
                      <span className="font-semibold">{f.name || "(unnamed)"}</span>{" "}
                      <span className="text-sm text-fg-muted">{fieldTypeLabel(f.type)}</span>
                      <span className="ms-2 inline-flex flex-wrap gap-1 align-middle">
                        {isNew ? <Badge tone="info">New</Badge> : null}
                        {f.required ? <Badge>Required</Badge> : null}
                        {f.unique ? <Badge>Unique</Badge> : null}
                        {f.access.defaultMode === "hidden" ? <Badge>Hidden</Badge> : null}
                        {fieldIssues.length > 0 ? (
                          <Badge tone="critical">
                            {fieldIssues.length} issue{fieldIssues.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null}
                      </span>
                    </button>
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<ArrowUp />}
                        aria-label={`Move ${f.name || "field"} up`}
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...draft];
                          const [moved] = next.splice(index, 1);
                          if (moved) {
                            next.splice(index - 1, 0, moved);
                          }
                          edit(next);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Trash2 />}
                        aria-label={`Remove ${f.name || "field"}`}
                        onClick={() => {
                          edit(draft.filter((d) => d.id !== f.id));
                          if (selection?.fieldId === f.id) {
                            setSelection(null);
                          }
                        }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {removed.length > 0 ? (
            <div className="mt-4 grid gap-2">
              <h3 className="text-sm font-semibold">Removed in this draft</h3>
              <ul className="m-0 grid list-none gap-1 p-0">
                {removed.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{f.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      leadingIcon={<RotateCcw />}
                      onClick={() => edit([...draft, f])}
                    >
                      Restore {f.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel
          title={
            selected ? (selection?.isNew ? "New field" : `Edit ${selected.name}`) : "Field settings"
          }
        >
          {selected && selection ? (
            <FieldEditor
              field={selected}
              isNew={selection.isNew}
              draftFields={draft}
              tables={catalog}
              issues={issuesFor(selected.id)}
              onChange={(next) => edit(draft.map((f) => (f.id === next.id ? next : f)))}
            />
          ) : (
            <EmptyState
              title="No field selected"
              description="Select a field to edit it, or add a new one."
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Draft changes"
        description="Your edits in plain words. The DDL engine's plan below is the source of truth."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={changes.length === 0}
              onClick={() => {
                edit(table.fields);
                setSelection(null);
              }}
            >
              Discard draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={preview.state === "planning"}
              disabled={changes.length === 0 || issues.length > 0}
              onClick={() => void requestPreview()}
            >
              Preview schema change
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {changes.length === 0 ? (
            <p className="text-fg-muted">No unsaved changes.</p>
          ) : (
            <ul className="m-0 list-disc ps-5 text-sm">
              {changes.map((c) => (
                <li key={`${c.fieldId}:${c.kind}`}>{c.description}</li>
              ))}
            </ul>
          )}
          {issues.length > 0 ? (
            <p role="alert" className="text-sm text-critical">
              Fix {issues.length} field issue{issues.length === 1 ? "" : "s"} before previewing.
            </p>
          ) : null}
          {preview.state === "error" ? (
            <p role="alert" className="text-sm text-critical">
              Could not plan this change: {preview.message}
            </p>
          ) : null}
        </div>
      </Panel>

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
          <p role="alert" className="text-sm">
            The draft changed after this plan was created. Preview again.
          </p>
        )
      ) : null}
      {apply.state === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-critical bg-critical-subtle p-3 text-sm"
        >
          Not applied: {apply.message}
        </p>
      ) : null}
      {apply.state === "done" ? (
        <p role="status" className="rounded-md border border-success bg-success-subtle p-3 text-sm">
          Published version <span className="font-mono">{apply.result.publishedVersion}</span> at{" "}
          {new Date(apply.result.committedAt).toLocaleString(undefined, { timeZoneName: "short" })}.
          Audit event <span className="font-mono">{apply.result.auditEventId}</span>.
        </p>
      ) : null}
    </PageContainer>
  );
}

/** Route view with loading / not-found / error states around the designer. */
export function TableDesignerPageView({ tableId }: { readonly tableId: string }): ReactElement {
  const table = useTableDefinition(tableId);
  const catalog = useTableCatalog();

  if (table.status === "loading" || catalog.status === "loading") {
    return (
      <PageContainer width="wide">
        <LoadingSkeleton label="Loading table definition" />
      </PageContainer>
    );
  }
  if (table.status === "error" || catalog.status === "error") {
    const failed = table.status === "error" ? table : catalog;
    return (
      <PageContainer width="wide">
        <LoadError
          title="Table definition could not be loaded"
          error={failed.error}
          onRetry={() => {
            table.retry();
            catalog.retry();
          }}
        />
      </PageContainer>
    );
  }
  if (!table.value) {
    return (
      <PageContainer width="wide">
        <Card>
          <EmptyState
            size="page"
            title="Table not available"
            description="This table does not exist or your position may not design it."
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
  return (
    <>
      <div className="sr-only">
        <SyncBadge sync={table.sync} />
      </div>
      <Designer table={table.value} catalog={catalog.value ?? []} />
    </>
  );
}

export function TableDesignerPageRoute(): ReactElement {
  const { tableId } = useParams({ strict: false });
  if (!tableId) {
    return (
      <PageContainer>
        <EmptyState size="page" title="No table selected" />
      </PageContainer>
    );
  }
  return <TableDesignerPageView key={tableId} tableId={tableId} />;
}
