import {
  Button,
  Field,
  Input,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@argus/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useMemo, useState } from "react";
import "./boards.css";
import { useBoardIdParam } from "./board-runtime-page.js";
import { validateConfig } from "./config-schema.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { type BoardDiff, diffBoards, summarizeDiff } from "./diff.js";
import { useBoardsEnvironment } from "./environment.js";
import { validateItems } from "./layout-ops.js";
import type { BoardBundle, BoardMutationOutcome, BoardVersionSummary } from "./model.js";
import {
  useBoardSummary,
  useBoardVersion,
  useBoardVersions,
  useDraftBoard,
  usePublishedBoard,
} from "./queries.js";
import {
  Badge,
  EmptyState,
  ErrorState,
  formatTimestamp,
  LoadingState,
  NoScopeState,
} from "./states.js";

/** Problems that must be fixed before a draft may be published (server re-checks authoritatively). */
export function publishBlockers(bundle: BoardBundle): readonly string[] {
  const problems: string[] = [];
  const blockIds = new Set(bundle.definition.blocks.map((b) => b.id));
  for (const block of bundle.definition.blocks) {
    for (const issue of validateConfig(block.type, block.config)) {
      problems.push(`${block.name}: ${issue.message}`);
    }
  }
  for (const layout of bundle.layout.layouts) {
    for (const problem of validateItems(layout.items, blockIds)) {
      problems.push(`${layout.breakpoint} layout: ${problem.message}`);
    }
  }
  return problems;
}

function Change({
  path,
  before,
  after,
}: {
  readonly path: string;
  readonly before: string;
  readonly after: string;
}): ReactElement {
  return (
    <li className="boards-diff-change">
      <strong>{path}</strong>
      <div className="boards-diff-values">
        <div>
          <span className="argus-muted">Before</span>
          <pre>{before}</pre>
        </div>
        <div>
          <span className="argus-muted">After</span>
          <pre>{after}</pre>
        </div>
      </div>
    </li>
  );
}

function rectText(item: { x: number; y: number; width: number; height: number } | null): string {
  return item ? `col ${item.x + 1}, row ${item.y + 1}, ${item.width}×${item.height}` : "—";
}

export function DiffView({ diff }: { readonly diff: BoardDiff }): ReactElement {
  if (diff.isEmpty) {
    return <EmptyState title="No differences">The two versions are identical.</EmptyState>;
  }
  return (
    <div className="boards-pane">
      {diff.meta.length > 0 ? (
        <section aria-label="Board settings changes">
          <h3>Board settings</h3>
          <ul className="boards-pane">
            {diff.meta.map((c) => (
              <Change key={c.path} {...c} />
            ))}
          </ul>
        </section>
      ) : null}
      {diff.added.length > 0 ? (
        <section aria-label="Added blocks">
          <h3>Added blocks ({diff.added.length})</h3>
          <ul>
            {diff.added.map((b) => (
              <li key={b.id} className="boards-diff-add">
                <strong>Added:</strong> {b.name} <span className="argus-muted">({b.type})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {diff.removed.length > 0 ? (
        <section aria-label="Removed blocks">
          <h3>Removed blocks ({diff.removed.length})</h3>
          <ul>
            {diff.removed.map((b) => (
              <li key={b.id} className="boards-diff-remove">
                <strong>Removed:</strong> {b.name} <span className="argus-muted">({b.type})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {diff.changed.length > 0 ? (
        <section aria-label="Changed blocks">
          <h3>Changed blocks ({diff.changed.length})</h3>
          {diff.changed.map((block) => (
            <details key={block.id} open>
              <summary>
                {block.name} <span className="argus-muted">({block.type})</span> —{" "}
                {block.changes.length} change{block.changes.length === 1 ? "" : "s"}
              </summary>
              <ul className="boards-pane">
                {block.changes.map((c) => (
                  <Change key={c.path} {...c} />
                ))}
              </ul>
            </details>
          ))}
        </section>
      ) : null}
      {diff.layout.map((bp) => (
        <section key={bp.breakpoint} aria-label={`${bp.breakpoint} layout changes`}>
          <h3>Layout: {bp.breakpoint}</h3>
          <ul>
            {bp.changes.map((c) => (
              <li
                key={c.blockId}
                className={
                  c.kind === "added"
                    ? "boards-diff-add"
                    : c.kind === "removed"
                      ? "boards-diff-remove"
                      : "boards-diff-change"
                }
              >
                <strong>{c.blockName}</strong> — {c.kind}: {rectText(c.before)} →{" "}
                {rectText(c.after)}
                {c.kind === "visibility"
                  ? ` (hidden: ${c.before?.hidden} → ${c.after?.hidden})`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type Target = "draft" | number;

/**
 * Version comparison with audited publish and rollback.
 * Input: `boardId` route param; published, draft and historical bundles from the repository.
 * Output: a structural diff by stable block identity plus confirmation dialogs for publish/restore.
 * Errors: load and mutation failures are explicit; stale optimistic versions are rejected by the API.
 * Depends on: BoardsRepositoryPort (versions, publish, rollback), RBAC `publish` permission.
 */
export function BoardDiffPage(): ReactElement {
  const boardId = useBoardIdParam();
  const { scope, repository } = useBoardsEnvironment();
  const queryClient = useQueryClient();
  const summary = useBoardSummary(boardId);
  const published = usePublishedBoard(boardId);
  const draft = useDraftBoard(boardId);
  const versions = useBoardVersions(boardId);

  const publishedVersion = published.data?.definition.version ?? null;
  const [baseChoice, setBaseChoice] = useState<number | null>(null);
  const [targetChoice, setTargetChoice] = useState<Target | null>(null);
  const baseVersion = baseChoice ?? publishedVersion;
  const target: Target | null = targetChoice ?? (draft.data ? "draft" : null);

  const baseQuery = useBoardVersion(boardId, baseVersion);
  const targetQuery = useBoardVersion(boardId, typeof target === "number" ? target : null);
  const base = baseQuery.data;
  const head: BoardBundle | undefined =
    target === "draft" ? (draft.data ?? undefined) : targetQuery.data;

  const diff = useMemo(() => (base && head ? diffBoards(base, head) : null), [base, head]);

  const [dialog, setDialog] = useState<"publish" | "rollback" | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  const finish = (result: BoardMutationOutcome, label: string): void => {
    setDialog(null);
    setChangeSummary("");
    setConfirmName("");
    setOutcome(`${label} as version ${result.version}. Audit event ${result.auditEventId}.`);
    void queryClient.invalidateQueries({ queryKey: ["boards"] });
  };

  const publish = useMutation({
    mutationFn: async () => {
      if (!scope || !draft.data) throw new Error("Nothing to publish");
      return repository.publish({
        scope,
        boardId,
        expectedVersion: draft.data.definition.version,
        changeSummary: changeSummary.trim(),
        idempotencyKey,
      });
    },
    onSuccess: (result) => finish(result, "Published"),
  });

  const rollback = useMutation({
    mutationFn: async () => {
      if (!scope || publishedVersion === null || restoreVersion === null) {
        throw new Error("Nothing to restore");
      }
      return repository.rollback({
        scope,
        boardId,
        expectedPublishedVersion: publishedVersion,
        restoreVersion,
        changeSummary: changeSummary.trim(),
        idempotencyKey,
      });
    },
    onSuccess: (result) => finish(result, "Restored"),
  });

  if (!scope) {
    return (
      <PageContainer width="wide">
        <PageHeader title="Compare versions" />
        <NoScopeState />
      </PageContainer>
    );
  }

  const boardName = published.data?.definition.name ?? draft.data?.definition.name ?? "this board";
  const canPublish = summary?.permissions.publish === true;
  const blockers = draft.data ? publishBlockers(draft.data) : [];
  const versionList: readonly BoardVersionSummary[] = versions.data ?? [];

  const openPublish = (): void => {
    publish.reset();
    setChangeSummary("");
    setIdempotencyKey(crypto.randomUUID());
    setDialog("publish");
  };
  const openRollback = (version: number): void => {
    rollback.reset();
    setRestoreVersion(version);
    setChangeSummary(`Restore version ${version}`);
    setConfirmName("");
    setIdempotencyKey(crypto.randomUUID());
    setDialog("rollback");
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title={`Compare versions — ${boardName}`}
        breadcrumbs={[
          { label: "Boards", link: <Link to="/boards">Boards</Link> },
          {
            label: boardName,
            link: (
              <Link to="/boards/$boardId" params={{ boardId }}>
                {boardName}
              </Link>
            ),
          },
          { label: "Compare versions" },
        ]}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {publishedVersion !== null ? (
              <Badge tone="success">Published v{publishedVersion}</Badge>
            ) : null}
            {draft.data ? <Badge tone="warning">Draft v{draft.data.definition.version}</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button asChild>
              <Link to="/boards/$boardId/builder" params={{ boardId }}>
                Back to builder
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/boards/$boardId" params={{ boardId }}>
                View published
              </Link>
            </Button>
          </>
        }
      />

      {outcome ? (
        <p
          className="rounded-md border border-success bg-success-subtle p-3 text-fg"
          role="status"
        >
          {outcome}
        </p>
      ) : null}

      {published.isError ? (
        <ErrorState
          title="Could not load the published board"
          error={published.error}
          onRetry={() => void published.refetch()}
        />
      ) : draft.isError ? (
        <ErrorState
          title="Could not load the draft"
          error={draft.error}
          onRetry={() => void draft.refetch()}
        />
      ) : published.isPending || draft.isPending ? (
        <LoadingState label="Loading versions" />
      ) : (
        <>
          <Panel title="Choose versions">
            <div className="grid gap-(--argus-gap) sm:grid-cols-2">
              <Field label="Compare from">
                <Select
                  value={baseVersion === null ? "" : String(baseVersion)}
                  onValueChange={(value) => setBaseChoice(Number(value))}
                  options={versionList
                    .filter((v) => v.lifecycle !== "draft")
                    .map((v) => ({
                      value: String(v.version),
                      label: `v${v.version} (${v.lifecycle}${v.version === publishedVersion ? ", live" : ""})`,
                    }))}
                />
              </Field>
              <Field label="Compare to">
                <Select
                  value={target === null ? "" : String(target)}
                  placeholder="Choose…"
                  onValueChange={(value) =>
                    setTargetChoice(value === "draft" ? "draft" : Number(value))
                  }
                  options={[
                    ...(draft.data
                      ? [{ value: "draft", label: `Draft v${draft.data.definition.version}` }]
                      : []),
                    ...versionList
                      .filter((v) => v.lifecycle !== "draft")
                      .map((v) => ({
                        value: String(v.version),
                        label: `v${v.version} (${v.lifecycle})`,
                      })),
                  ]}
                />
              </Field>
            </div>
          </Panel>

          {target === null ? (
            <EmptyState title="Nothing to compare">
              There is no draft. Pick a version to compare against the published board.
            </EmptyState>
          ) : baseQuery.isError || targetQuery.isError ? (
            <ErrorState
              title="Could not load a version"
              error={baseQuery.error ?? targetQuery.error}
              onRetry={() => {
                void baseQuery.refetch();
                void targetQuery.refetch();
              }}
            />
          ) : !diff ? (
            <LoadingState label="Loading comparison" />
          ) : (
            <Panel title="Differences" description={summarizeDiff(diff)}>
              <DiffView diff={diff} />
            </Panel>
          )}

          {target === "draft" && draft.data && canPublish ? (
            <Panel title="Publish draft">
              <div className="grid gap-3">
                {baseVersion !== publishedVersion ? (
                  <p className="rounded-md border border-warning bg-warning-subtle p-3">
                    You are comparing against an older version. Publishing replaces the live version
                    v{publishedVersion}, not v{baseVersion}.
                  </p>
                ) : null}
                {blockers.length > 0 ? (
                  <div
                    className="rounded-md border border-critical bg-critical-subtle p-3"
                    role="alert"
                  >
                    <strong>Fix these before publishing:</strong>
                    <ul className="list-disc ps-5">
                      {blockers.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <Button
                    variant="primary"
                    disabled={blockers.length > 0 || (diff?.isEmpty ?? true)}
                    onClick={openPublish}
                  >
                    Publish v{draft.data.definition.version}…
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel title="Version history" flush>
            {versions.isError ? (
              <ErrorState
                title="Could not load history"
                error={versions.error}
                onRetry={() => void versions.refetch()}
              />
            ) : versions.isPending ? (
              <LoadingState label="Loading history" />
            ) : versionList.length === 0 ? (
              <EmptyState title="No versions yet" />
            ) : (
              <TableContainer>
                <Table>
                  <TableCaption className="sr-only">Board versions</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versionList.map((v) => (
                      <TableRow key={v.version}>
                        <TableCell mono>v{v.version}</TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              v.version === publishedVersion
                                ? "success"
                                : v.lifecycle === "draft"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {v.version === publishedVersion ? "live" : v.lifecycle}
                          </Badge>
                        </TableCell>
                        <TableCell>{v.changeSummary ?? "—"}</TableCell>
                        <TableCell>{formatTimestamp(v.publishedAt)}</TableCell>
                        <TableCell>
                          {v.lifecycle !== "draft" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                aria-label={`Compare version ${v.version} with live`}
                                onClick={() => {
                                  setBaseChoice(v.version);
                                  setTargetChoice(publishedVersion ?? "draft");
                                }}
                              >
                                Compare
                              </Button>
                              {canPublish && v.version !== publishedVersion ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  aria-label={`Restore version ${v.version}`}
                                  onClick={() => openRollback(v.version)}
                                >
                                  Restore…
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={dialog === "publish"}
        title={`Publish “${boardName}”`}
        confirmLabel="Publish"
        pending={publish.isPending}
        confirmDisabled={changeSummary.trim() === ""}
        onConfirm={() => publish.mutate()}
        onCancel={() => setDialog(null)}
      >
        <p>
          Draft v{draft.data?.definition.version} becomes the live board for everyone with access
          {diff ? ` (${summarizeDiff(diff)})` : ""}. This is recorded in the audit log.
        </p>
        <Field label="Change summary" required>
          <Textarea
            maxLength={2000}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
          />
        </Field>
        {publish.isError ? <ErrorState title="Publish failed" error={publish.error} /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "rollback"}
        title={`Restore version ${restoreVersion} of “${boardName}”`}
        confirmLabel={`Restore v${restoreVersion}`}
        tone="danger"
        pending={rollback.isPending}
        confirmDisabled={changeSummary.trim() === "" || confirmName !== boardName}
        onConfirm={() => rollback.mutate()}
        onCancel={() => setDialog(null)}
      >
        <p>
          Version {restoreVersion} replaces live version {publishedVersion} immediately. The current
          live version stays in history. This is recorded in the audit log.
        </p>
        <Field label="Change summary" required>
          <Textarea
            maxLength={2000}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
          />
        </Field>
        <Field label={`Type the board name “${boardName}” to confirm`} required>
          <Input
            value={confirmName}
            autoComplete="off"
            onChange={(event) => setConfirmName(event.target.value)}
          />
        </Field>
        {rollback.isError ? <ErrorState title="Restore failed" error={rollback.error} /> : null}
      </ConfirmDialog>
    </PageContainer>
  );
}
