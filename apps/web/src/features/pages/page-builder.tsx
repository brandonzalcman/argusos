import {
  type AnyBlockModule,
  type BlockRegistry,
  type BlockRenderContext,
  coreBlockRegistry,
} from "@argus/blocks";
import {
  type DefinitionIssue,
  type PageDefinition,
  pageDefinitionSchema,
  type StudioGetOutput,
  type StudioItemPermissions,
  type StudioPermissions,
} from "@argus/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Kbd,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  SkeletonGroup,
  SkeletonText,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ToastApi,
  Tooltip,
  useToast,
} from "@argus/ui";
import { Code2, ExternalLink, Lock, Redo2, Undo2 } from "@argus/ui/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useStudioPort } from "../../services/studio.js";
import {
  addBlock,
  type BlockKind,
  type BoardBundle,
  BuilderCanvas,
  copyBlocks,
  Inspector,
  type LayoutBreakpoint,
  layoutOps,
  moveBlockTo,
  nudgeBlock,
  PALETTE_MIME,
  pasteBlocks,
  readSessionClipboard,
  removeBlock,
  setBlockHidden,
  useBoardsEnvironment,
  useBuilderExtensions,
  writeSessionClipboard,
} from "../boards/index.js";
import { DefinitionCodeView } from "../studio/code-view.js";
import { useDevMode } from "../studio/dev-mode.js";
import { useSessionSnapshot } from "../studio/session.js";
import { isNotConnected } from "../studio/studio-index-page.js";
import {
  canRedoPage,
  canUndoPage,
  createPageBuilderState,
  isPageDirty,
  pageBuilderReducer,
} from "./page-builder-state.js";
import { bundleToPage, pageToBundle } from "./page-bundle.js";
import { PageBlocks, pageOf } from "./page-runtime.js";
import { PageSettings } from "./page-settings.js";
import { validatePageSlug } from "./page-slug.js";
import { summarizePageChanges } from "./page-summary.js";
import { PublishDialog } from "./publish-dialog.js";

type EditorMode = "design" | "code" | "preview";

const breakpointOptions: readonly { value: LayoutBreakpoint; label: string }[] = [
  { value: "desktop", label: "Desktop (1280+)" },
  { value: "tablet", label: "Tablet (768+)" },
  { value: "phone", label: "Phone (390)" },
  { value: "video-wall", label: "Video wall (2560+)" },
];

const previewWidth: Readonly<Record<LayoutBreakpoint, string>> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
  "video-wall": "100%",
};

const categoryLabels: Readonly<Record<AnyBlockModule["category"], string>> = {
  data: "Data",
  display: "Display",
  layout: "Layout",
  action: "Actions",
  media: "Media",
  collaboration: "Collaboration",
  external: "External",
};

function groupByCategory(
  registry: BlockRegistry,
): [AnyBlockModule["category"], AnyBlockModule[]][] {
  const groups = new Map<AnyBlockModule["category"], AnyBlockModule[]>();
  for (const module of registry.list()) {
    groups.set(module.category, [...(groups.get(module.category) ?? []), module]);
  }
  return [...groups.entries()];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function displayNameOf(registry: BlockRegistry, kind: BlockKind): string {
  try {
    return registry.get(kind).displayName;
  } catch {
    return kind;
  }
}

function useOptionalToast(): ToastApi | undefined {
  try {
    return useToast();
  } catch {
    return undefined;
  }
}

/** Read-only positions: edits from the shared inspector are dropped. */
const ignoreEdit = (): void => undefined;

const isConflict = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith("definition-version-conflict");

function describeError(error: unknown): string {
  if (isNotConnected(error)) return "Studio isn't connected yet, so nothing can be saved.";
  if (!(error instanceof Error)) return "Something went wrong.";
  // Server error codes look like "validation-failed: details"; show the details.
  const [, detail] = /^[a-z][a-z-]*: (.*)$/s.exec(error.message) ?? [];
  return detail ?? error.message;
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random()}`;
}

function pageProblems(page: PageDefinition): string[] {
  const result = pageDefinitionSchema.safeParse(page);
  const problems: string[] = [];
  const slugProblem = validatePageSlug(page.slug);
  if (slugProblem) problems.push(`URL slug: ${slugProblem}`);
  if (!result.success) {
    for (const issue of result.error.issues.slice(0, 6)) {
      const path = issue.path.join(".");
      const message = `${path ? `${path}: ` : ""}${issue.message}`;
      if (!problems.includes(message) && !(path === "slug" && slugProblem)) problems.push(message);
    }
  }
  return problems;
}

interface WorkspaceProps {
  readonly id: string;
  readonly initial: PageDefinition;
  readonly initialHasDraft: boolean;
  readonly summary: StudioGetOutput["summary"];
  readonly permissions: StudioPermissions;
  readonly onReload: () => void;
}

function PageWorkspace({
  id,
  initial,
  initialHasDraft,
  summary,
  permissions,
  onReload,
}: WorkspaceProps): ReactElement {
  const studio = useStudioPort();
  const { scope, data, expressions } = useBoardsEnvironment();
  const { snapshot } = useSessionSnapshot();
  const queryClient = useQueryClient();
  const toast = useOptionalToast();
  const registry = coreBlockRegistry;

  const [state, dispatch] = useReducer(pageBuilderReducer, initial, createPageBuilderState);
  const [mode, setMode] = useState<EditorMode>("design");
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [publishedVersion, setPublishedVersion] = useState(summary.publishedVersion);
  const [publishOpen, setPublishOpen] = useState(false);
  const [clipboardCount, setClipboardCount] = useState(
    () => readSessionClipboard()?.blocks.length ?? 0,
  );
  const [pasteWarnings, setPasteWarnings] = useState<readonly string[]>([]);

  const extensions = useBuilderExtensions();
  const itemPermissions: StudioItemPermissions = summary.permissions;
  const canEdit = permissions.editDefinitions && itemPermissions.edit;
  const canPublish = permissions.publishDefinitions && itemPermissions.publish;
  const canEditCode = canEdit && permissions.editCode && itemPermissions.editCode;

  const page = state.history.present;
  const bundle = useMemo(() => pageToBundle(page), [page]);
  const dirty = isPageDirty(state);
  const items = layoutOps.layoutFor(bundle.layout, state.breakpoint);
  const selection = state.selectedIds;
  const selectedBlock = bundle.definition.blocks.find((block) => block.id === state.selectedId);
  const selectedItem = items.find((item) => item.blockId === state.selectedId);
  const hiddenItems = items.filter((item) => item.hidden);

  const editPage = useCallback(
    (next: PageDefinition, options?: { key?: string; announce?: string }) =>
      dispatch({
        type: "edit",
        next,
        at: Date.now(),
        ...(options?.key ? { key: options.key } : {}),
        ...(options?.announce ? { announce: options.announce } : {}),
      }),
    [],
  );
  const pageRef = useRef(page);
  pageRef.current = page;
  const editBundle = useCallback(
    (next: BoardBundle, options?: { key?: string; announce?: string }) =>
      editPage(bundleToPage(pageRef.current, next), options),
    [editPage],
  );

  const context = useMemo<BlockRenderContext | null>(
    () => (scope ? { scope, boardId: id, definitionVersion: page.version, mode: "builder" } : null),
    [scope, id, page.version],
  );

  // The published revision (for "View page" and the publish change list).
  const published = useQuery({
    queryKey: ["studio", "page-published", id],
    queryFn: () => studio.get({ kind: "page", id, revision: "published" }),
    enabled: publishedVersion !== null,
    retry: false,
  });
  const publishedPage = published.data ? pageOf(published.data) : null;

  const refreshLists = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["studio", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["studio", "page-published", id] });
    void queryClient.invalidateQueries({ queryKey: ["studio", "page-by-slug"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const toSave = pageRef.current;
      const result = await studio.saveDraft({
        id,
        baseVersion: state.baseVersion,
        document: { kind: "page", definition: toSave },
      });
      return { version: result.version, page: toSave };
    },
    onSuccess: ({ version, page: saved }) => {
      dispatch({ type: "saved", version, page: saved });
      setHasDraft(true);
      refreshLists();
      toast?.toast({ title: "Draft saved", description: `Version ${version}.`, tone: "success" });
    },
    onError: (error) => {
      if (!isConflict(error)) {
        toast?.toast({
          title: "Draft not saved",
          description: describeError(error),
          tone: "critical",
        });
      }
    },
  });

  const publish = useMutation({
    mutationFn: async (changeSummary: string) => {
      let version = state.baseVersion;
      if (dirty || !hasDraft) {
        const toSave = pageRef.current;
        const saved = await studio.saveDraft({
          id,
          baseVersion: state.baseVersion,
          document: { kind: "page", definition: toSave },
        });
        dispatch({ type: "saved", version: saved.version, page: toSave });
        setHasDraft(true);
        version = saved.version;
      }
      const result = await studio.publish({
        kind: "page",
        id,
        expectedVersion: version,
        changeSummary,
        idempotencyKey: newIdempotencyKey(),
      });
      return result.version;
    },
    onSuccess: (version) => {
      setPublishedVersion(version);
      setHasDraft(false);
      setPublishOpen(false);
      refreshLists();
      toast?.toast({
        title: "Page published",
        description: `Version ${version} is live at /p/${pageRef.current.slug}.`,
        tone: "success",
      });
    },
    onError: (error) => {
      if (isConflict(error)) setPublishOpen(false);
    },
  });

  const conflict = [save.error, publish.error].some(isConflict);

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const blockName = (blockId: string): string =>
    bundle.definition.blocks.find((block) => block.id === blockId)?.name ?? blockId;

  const addFromPalette = (kind: BlockKind, cell?: { x: number; y: number }): void => {
    if (!canEdit) return;
    const module = registry.get(kind);
    const blockId = crypto.randomUUID();
    let next = addBlock(bundle, kind, module.displayName, blockId);
    if (cell) {
      const placed = layoutOps
        .layoutFor(next.layout, state.breakpoint)
        .find((item) => item.blockId === blockId);
      if (placed) {
        next = moveBlockTo(next, state.breakpoint, blockId, { ...placed, x: cell.x, y: cell.y });
      }
    }
    editBundle(next, { announce: `Added ${module.displayName}.` });
    dispatch({ type: "select", id: blockId });
  };

  const moveSelection = (
    ids: readonly string[],
    dx: number,
    dy: number,
    announce: string,
  ): void => {
    const moved = layoutOps.moveGroup(items, new Set(ids), dx, dy);
    editBundle(
      { ...bundle, layout: layoutOps.withBreakpointItems(bundle.layout, state.breakpoint, moved) },
      { announce },
    );
  };

  const removeSelection = (ids: readonly string[]): void => {
    let next = bundle;
    for (const blockId of ids) next = removeBlock(next, blockId);
    editBundle(next, {
      announce: `Removed ${ids.length === 1 ? blockName(ids[0] ?? "") : `${ids.length} blocks`}. Press Ctrl+Z to undo.`,
    });
  };

  const copySelection = (): void => {
    const clip = copyBlocks(bundle, selection, id);
    if (!clip) return;
    writeSessionClipboard(clip);
    setClipboardCount(clip.blocks.length);
    dispatch({
      type: "announce",
      message: `Copied ${clip.blocks.length} block${clip.blocks.length === 1 ? "" : "s"}.`,
    });
  };

  const pasteClipboard = (clip = readSessionClipboard()): void => {
    if (!clip || !canEdit) return;
    const result = pasteBlocks(bundle, clip, () => crypto.randomUUID());
    setPasteWarnings(result.warnings);
    editBundle(result.bundle, {
      announce: `Pasted ${result.newIds.length} block${result.newIds.length === 1 ? "" : "s"}.`,
    });
    dispatch({ type: "select-many", ids: result.newIds });
  };

  const duplicateSelection = (): void => {
    const clip = copyBlocks(bundle, selection, id);
    if (clip) pasteClipboard(clip);
  };

  const onKeyDown = (event: globalThis.KeyboardEvent): void => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "s") {
      event.preventDefault();
      if (canEdit && dirty && !save.isPending) save.mutate();
      return;
    }
    if (isEditableTarget(event.target) || mode !== "design") return;
    if (mod && key === "z") {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    } else if (mod && key === "y") {
      event.preventDefault();
      dispatch({ type: "redo" });
    } else if (mod && key === "c" && selection.length > 0) {
      event.preventDefault();
      copySelection();
    } else if (mod && key === "v") {
      event.preventDefault();
      pasteClipboard();
    } else if (mod && key === "d" && selection.length > 0) {
      event.preventDefault();
      duplicateSelection();
    } else if (key === "escape" && selection.length > 0) {
      dispatch({ type: "select", id: null });
    }
  };
  const keyHandler = useRef(onKeyDown);
  keyHandler.current = onKeyDown;
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent): void => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Code view: whole PageDefinition; identity and revision metadata are not editable as code.
  const codeChecks = useCallback(
    (next: PageDefinition): readonly DefinitionIssue[] => {
      const issues: DefinitionIssue[] = [];
      for (const field of ["id", "tenantId", "version", "lifecycle"] as const) {
        if (next[field] !== initial[field]) {
          issues.push({
            path: [field],
            message: "This field is managed by the server and can't be changed here.",
            severity: "error",
          });
        }
      }
      return issues;
    },
    [initial],
  );

  const positions = snapshot?.availablePositions ?? [];
  const changes = useMemo(() => {
    if (publishedVersion === null) return summarizePageChanges(null, page);
    return publishedPage ? summarizePageChanges(publishedPage, page) : [];
  }, [publishedVersion, publishedPage, page]);
  const problems = useMemo(() => pageProblems(page), [page]);
  const publishedSlug = publishedPage?.slug ?? (publishedVersion !== null ? summary.slug : null);

  const saveState = save.isPending
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : hasDraft
        ? "All changes saved"
        : "No unsaved changes";

  return (
    <PageContainer width="full">
      <div className="grid gap-(--argus-gap)">
        <PageHeader
          eyebrow="Dev mode · Page builder"
          title={page.title.trim() === "" ? "Untitled page" : page.title}
          breadcrumbs={[
            { label: "Studio", link: <Link to="/studio">Studio</Link> },
            { label: "Pages" },
            { label: page.title || "Untitled page" },
          ]}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              {hasDraft ? (
                <Badge tone="warning">Draft v{state.baseVersion}</Badge>
              ) : (
                <Badge>Published v{state.baseVersion}, no draft yet</Badge>
              )}
              {publishedVersion !== null ? (
                <Badge tone="success">Live v{publishedVersion}</Badge>
              ) : (
                <Badge>Not published</Badge>
              )}
              <span role="status" aria-live="polite" className="text-fg-muted">
                {saveState}
              </span>
            </span>
          }
          actions={
            <>
              {publishedSlug ? (
                <Button asChild variant="ghost" leadingIcon={<ExternalLink />}>
                  <Link to="/p/$slug" params={{ slug: publishedSlug }}>
                    View page
                  </Link>
                </Button>
              ) : null}
              {canPublish ? (
                <Button
                  variant="primary"
                  disabled={conflict}
                  onClick={() => {
                    publish.reset();
                    setPublishOpen(true);
                  }}
                >
                  Publish…
                </Button>
              ) : null}
            </>
          }
        />

        {conflict ? (
          <ErrorState
            title="This page changed somewhere else"
            description="Someone saved a newer version while you were editing, so your changes weren't saved. Reload to get the latest version (your unsaved edits here will be lost), or copy them from the Code view first."
            retryLabel="Reload latest version"
            onRetry={onReload}
          />
        ) : null}
        {save.isError && !conflict ? (
          <ErrorState
            title="Draft not saved"
            description={describeError(save.error)}
            onRetry={() => save.mutate()}
            retrying={save.isPending}
          />
        ) : null}
        {!canEdit ? (
          <p
            role="note"
            className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken p-3 text-sm"
          >
            <Lock aria-hidden="true" className="size-4" />
            You can view this page's definition but your position can't edit it.
          </p>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value as EditorMode)}>
          <Card className="mb-(--argus-gap) flex flex-wrap items-center gap-2 p-2">
            <TabsList aria-label="Editor view">
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <div
              role="toolbar"
              aria-label="Builder actions"
              className="flex flex-wrap items-center gap-2"
            >
              <Tooltip content="Undo" shortcut={["Ctrl", "Z"]}>
                <Button
                  size="sm"
                  leadingIcon={<Undo2 />}
                  disabled={!canEdit || !canUndoPage(state)}
                  onClick={() => dispatch({ type: "undo" })}
                >
                  Undo
                </Button>
              </Tooltip>
              <Tooltip content="Redo" shortcut={["Ctrl", "Shift", "Z"]}>
                <Button
                  size="sm"
                  leadingIcon={<Redo2 />}
                  disabled={!canEdit || !canRedoPage(state)}
                  onClick={() => dispatch({ type: "redo" })}
                >
                  Redo
                </Button>
              </Tooltip>
              {mode === "design" ? (
                <>
                  <Button size="sm" disabled={selection.length === 0} onClick={copySelection}>
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit || clipboardCount === 0}
                    onClick={() => pasteClipboard()}
                  >
                    Paste{clipboardCount > 0 ? ` (${clipboardCount})` : ""}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit || selection.length === 0}
                    onClick={duplicateSelection}
                  >
                    Duplicate
                  </Button>
                </>
              ) : null}
              <Button
                size="sm"
                disabled={!canEdit || !dirty}
                onClick={() =>
                  editPage(state.savedPage, { announce: "Reverted to last saved draft." })
                }
              >
                Revert to saved
              </Button>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!dirty}
                  loading={save.isPending}
                  onClick={() => save.mutate()}
                >
                  Save draft
                </Button>
              ) : null}
            </div>
            <span className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-fg-muted">Layout for</span>
              <Select
                size="sm"
                aria-label="Layout breakpoint"
                value={state.breakpoint}
                onValueChange={(value) =>
                  dispatch({ type: "breakpoint", value: value as LayoutBreakpoint })
                }
                options={breakpointOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>
          </Card>

          <p className="sr-only" role="status" aria-live="polite">
            {state.announcement}
          </p>
          {pasteWarnings.length > 0 ? (
            <div
              className="mb-(--argus-gap) rounded-md border border-warning bg-warning-subtle p-3"
              role="status"
            >
              <strong>Review pasted blocks:</strong>
              <ul className="list-disc ps-5">
                {pasteWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" onClick={() => setPasteWarnings([])}>
                Dismiss
              </Button>
            </div>
          ) : null}

          <TabsContent value="design">
            <p className="mb-(--argus-gap) text-fg-muted">
              Focus a block, then <Kbd>Alt</Kbd>+arrows move it, <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>
              +arrows resize it, <Kbd>Delete</Kbd> removes it. <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> saves,{" "}
              <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undoes. The properties panel has numeric controls for
              every move and resize.
            </p>
            <div className="grid gap-(--argus-gap) lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start min-[1600px]:grid-cols-[14rem_minmax(0,1fr)_20rem]">
              <nav
                aria-label="Block palette"
                className="order-3 min-[1600px]:sticky min-[1600px]:top-4 min-[1600px]:order-1"
              >
                <Panel title="Blocks" headingLevel={2}>
                  <div className="grid max-h-[28rem] gap-3 overflow-auto min-[1600px]:max-h-[calc(100vh-14rem)]">
                    {groupByCategory(registry).map(([category, modules]) => (
                      <section
                        key={category}
                        aria-label={categoryLabels[category]}
                        className="grid gap-2"
                      >
                        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                          {categoryLabels[category]}
                        </h3>
                        {modules.map((module) => (
                          // biome-ignore lint/a11y/noStaticElementInteractions: drag is a pointer shortcut; the Add button is the keyboard path
                          <div
                            key={module.kind}
                            className="flex cursor-grab items-center justify-between gap-2 rounded-sm border border-border bg-surface p-2"
                            draggable={canEdit}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(PALETTE_MIME, module.kind);
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                          >
                            <div>
                              <strong className="text-sm">{module.displayName}</strong>
                              <p className="text-xs text-fg-muted">{module.description}</p>
                            </div>
                            <Button
                              size="sm"
                              disabled={!canEdit}
                              aria-label={`Add ${module.displayName} to page`}
                              onClick={() => addFromPalette(module.kind)}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                </Panel>
              </nav>

              <div className="order-1 grid min-w-0 gap-(--argus-gap) min-[1600px]:order-2">
                {context ? (
                  <BuilderCanvas
                    bundle={bundle}
                    items={items}
                    breakpoint={state.breakpoint}
                    selectedId={state.selectedId}
                    selectedIds={state.selectedIds}
                    registry={registry}
                    context={context}
                    data={data}
                    onSelect={(blockId, additive) =>
                      dispatch({ type: "select", id: blockId, toggle: additive === true })
                    }
                    onPlace={(blockId, rect, announce) =>
                      canEdit &&
                      editBundle(moveBlockTo(bundle, state.breakpoint, blockId, rect), {
                        announce,
                      })
                    }
                    onMoveGroup={(ids, dx, dy, announce) =>
                      canEdit && moveSelection(ids, dx, dy, announce)
                    }
                    onNudge={(blockId, delta, announce) => {
                      if (!canEdit) return;
                      const groupMove =
                        selection.length > 1 &&
                        selection.includes(blockId) &&
                        delta.dw === undefined &&
                        delta.dh === undefined;
                      if (groupMove) {
                        moveSelection(selection, delta.dx ?? 0, delta.dy ?? 0, announce);
                      } else {
                        editBundle(nudgeBlock(bundle, state.breakpoint, blockId, delta), {
                          announce,
                        });
                      }
                    }}
                    onRemove={(blockId) =>
                      canEdit &&
                      removeSelection(selection.includes(blockId) ? selection : [blockId])
                    }
                    onDropKind={addFromPalette}
                  />
                ) : (
                  <EmptyState
                    icon={<Code2 />}
                    title="Pages aren't connected yet"
                    description="There's no signed-in session to render blocks with. Page settings and the Code view still work."
                  />
                )}
                {hiddenItems.length > 0 ? (
                  <Panel title={`Hidden on ${state.breakpoint}`} headingLevel={2}>
                    <ul className="grid gap-2">
                      {hiddenItems.map((item) => (
                        <li key={item.blockId} className="flex items-center justify-between gap-2">
                          {blockName(item.blockId)}
                          <Button
                            size="sm"
                            disabled={!canEdit}
                            onClick={() =>
                              editBundle(
                                setBlockHidden(bundle, state.breakpoint, item.blockId, false),
                                { announce: `${blockName(item.blockId)} shown.` },
                              )
                            }
                          >
                            Show
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null}
              </div>

              <div className="order-2 lg:sticky lg:top-4 min-[1600px]:order-3">
                <Panel
                  title={selectedBlock ? "Block properties" : "Page settings"}
                  headingLevel={2}
                >
                  {selection.length > 1 ? (
                    <section className="grid gap-2" aria-label="Selection">
                      <p>
                        <strong>{selection.length} blocks selected</strong>
                      </p>
                      <ul className="list-disc ps-5 text-fg-muted">
                        {selection.map((blockId) => (
                          <li key={blockId}>{blockName(blockId)}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={copySelection}>
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!canEdit}
                          onClick={() => removeSelection(selection)}
                        >
                          Remove {selection.length} blocks
                        </Button>
                      </div>
                    </section>
                  ) : selectedBlock ? (
                    <Inspector
                      key={selectedBlock.id}
                      bundle={bundle}
                      block={selectedBlock}
                      item={selectedItem}
                      breakpoint={state.breakpoint}
                      validator={expressions}
                      displayName={displayNameOf(registry, selectedBlock.type)}
                      code={{ editable: canEditCode }}
                      onEdit={canEdit ? editBundle : ignoreEdit}
                      {...(canEdit && canEditCode && extensions.ejectBlock
                        ? { onEjectBlock: extensions.ejectBlock }
                        : {})}
                    />
                  ) : (
                    <PageSettings
                      page={page}
                      positions={positions}
                      editable={canEdit}
                      onEdit={editPage}
                    />
                  )}
                </Panel>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="code">
            <Panel title="Page definition" headingLevel={2}>
              <DefinitionCodeView<PageDefinition>
                value={page}
                schema={pageDefinitionSchema}
                label="Page definition code"
                editable={canEditCode}
                extraValidate={codeChecks}
                onApply={(next) =>
                  editPage(next, { announce: "Applied code changes to the draft." })
                }
              />
            </Panel>
          </TabsContent>

          <TabsContent value="preview">
            <section
              aria-label={`Preview of ${page.title}, ${state.breakpoint} layout`}
              className="mx-auto min-w-0 rounded-md border border-border bg-canvas p-(--argus-page-p) shadow-sm"
              style={{ maxWidth: previewWidth[state.breakpoint] }}
            >
              <h2 className="mb-3 text-xl font-semibold text-fg">{page.title}</h2>
              {page.description ? <p className="mb-3 text-fg-muted">{page.description}</p> : null}
              <PageBlocks page={page} breakpoint={state.breakpoint} />
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <PublishDialog
        open={publishOpen}
        pageTitle={page.title}
        slug={page.slug}
        changes={changes}
        problems={problems}
        unsaved={dirty || !hasDraft}
        pending={publish.isPending}
        error={publish.isError && !conflict ? describeError(publish.error) : null}
        onConfirm={(changeSummary) => publish.mutate(changeSummary)}
        onCancel={() => setPublishOpen(false)}
      />
    </PageContainer>
  );
}

interface LoadedPage {
  readonly output: StudioGetOutput;
  readonly page: PageDefinition;
  readonly hasDraft: boolean;
}

/** `/studio/pages/$pageId` body. Exported for tests; the route renders `PageBuilderPage`. */
export function PageBuilderView({ pageId }: { readonly pageId: string }): ReactElement {
  const studio = useStudioPort();
  const queryClient = useQueryClient();
  const { snapshot, loading } = useSessionSnapshot();
  const { available, permissions } = useDevMode();

  const query = useQuery({
    queryKey: ["studio", "page-draft", pageId],
    queryFn: async (): Promise<LoadedPage | null> => {
      const draft = await studio.get({ kind: "page", id: pageId, revision: "draft" });
      const output =
        draft ?? (await studio.get({ kind: "page", id: pageId, revision: "published" }));
      if (!output) return null;
      const page = pageOf(output);
      if (!page) throw new Error("The server returned a document that is not a page.");
      return { output, page, hasDraft: draft !== null };
    },
    // Edits live in the workspace; never refetch over unsaved work.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    enabled: snapshot !== null && snapshot !== undefined && available,
    retry: (count, error) => !isNotConnected(error) && count < 2,
  });

  const shell = (child: ReactElement): ReactElement => (
    <PageContainer width="wide">
      <PageHeader eyebrow="Dev mode" title="Page builder" />
      {child}
    </PageContainer>
  );

  if (loading) {
    return shell(
      <SkeletonGroup label="Loading session">
        <SkeletonText lines={3} />
      </SkeletonGroup>,
    );
  }
  if (!snapshot) {
    return shell(
      <EmptyState
        size="page"
        icon={<Code2 />}
        title="Sign in to use dev mode"
        description="Dev mode lets authorised positions build boards, pages and custom components in the browser. Sign-in isn't connected in this build yet."
      />,
    );
  }
  if (!available) {
    return shell(
      <EmptyState
        size="page"
        icon={<Code2 />}
        title="Dev mode isn't available for your position"
        description={`${snapshot.position.name} can't edit boards, pages or components. Ask an administrator for studio access.`}
      />,
    );
  }
  if (query.isPending) {
    return shell(
      <SkeletonGroup label="Loading page builder" className="grid gap-3">
        <SkeletonText lines={2} />
        <SkeletonText lines={6} />
      </SkeletonGroup>,
    );
  }
  if (query.isError) {
    return shell(
      isNotConnected(query.error) ? (
        <EmptyState
          size="page"
          icon={<Code2 />}
          title="Studio isn't connected yet"
          description="Drafts, versions and publishing are stored by the API. It isn't connected in this build, so this page can't be loaded or saved."
        />
      ) : (
        <ErrorState
          title="Couldn't load this page"
          description={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ),
    );
  }
  if (!query.data) {
    return shell(
      <EmptyState
        size="page"
        title="Page not found"
        description="This page doesn't exist or isn't available to your position."
        action={
          <Button asChild>
            <Link to="/studio">Back to Studio</Link>
          </Button>
        }
      />,
    );
  }

  return (
    <PageWorkspace
      key={query.dataUpdatedAt}
      id={pageId}
      initial={query.data.page}
      initialHasDraft={query.data.hasDraft}
      summary={query.data.output.summary}
      permissions={permissions}
      onReload={() => {
        void queryClient.invalidateQueries({ queryKey: ["studio", "page-draft", pageId] });
      }}
    />
  );
}

/**
 * `/studio/pages/$pageId` — page builder: Design | Code | Preview over one draft with undo/redo,
 * built on the shared board builder canvas and draft operations (via page-bundle.ts).
 * Input: `pageId` route param. Output: editable workspace; saving writes a draft with an optimistic
 * base version, publishing goes through a confirmation with an audited change summary.
 * Errors: not signed in, no studio access, not connected, not found, load/save failures and
 * `definition-version-conflict` each have an explicit state.
 */
export function PageBuilderPage(): ReactElement {
  const params = useParams({ strict: false });
  const pageId = typeof params.pageId === "string" ? params.pageId : "";
  return <PageBuilderView pageId={pageId} />;
}
