import {
  type AnyBlockModule,
  type BlockRegistry,
  type BlockRenderContext,
  coreBlockRegistry,
} from "@argus/blocks";
import { Button, Card, Kbd, PageContainer, PageHeader, Panel, Select, Tooltip } from "@argus/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useDevMode } from "../studio/dev-mode.js";
import "./boards.css";
import { useBoardIdParam } from "./board-runtime-page.js";
import { BuilderCanvas, PALETTE_MIME } from "./builder-canvas.js";
import { builderReducer, createBuilderState, isDirty } from "./builder-state.js";
import {
  copyBlocks,
  pasteBlocks,
  readSessionClipboard,
  writeSessionClipboard,
} from "./clipboard.js";
import { resolveCodeAccess } from "./code-mode.js";
import { BlockPicker, type BuilderMode, BundleCodeView, ModeSwitch } from "./code-panes.js";
import { addBlock, moveBlockTo, nudgeBlock, removeBlock, setBlockHidden } from "./draft.js";
import { useBoardsEnvironment } from "./environment.js";
import { useBuilderExtensions } from "./extensions.js";
import { canRedo, canUndo } from "./history.js";
import { Inspector } from "./inspector.js";
import { layoutFor, moveGroup, withBreakpointItems } from "./layout-ops.js";
import type { BlockKind, BoardBundle, LayoutBreakpoint } from "./model.js";
import { PositionPreviewControl, usePositionPreview } from "./position-preview.js";
import { useBoardSummary, useDraftBoard, usePublishedBoard } from "./queries.js";
import { Badge, ErrorState, LoadingState, NoScopeState } from "./states.js";

const breakpoints: readonly { value: LayoutBreakpoint; label: string }[] = [
  { value: "desktop", label: "Desktop (1280+)" },
  { value: "tablet", label: "Tablet (768+)" },
  { value: "phone", label: "Phone (390)" },
  { value: "video-wall", label: "Video wall (2560+)" },
];

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
): readonly (readonly [AnyBlockModule["category"], readonly AnyBlockModule[]])[] {
  const groups = new Map<AnyBlockModule["category"], AnyBlockModule[]>();
  for (const module of registry.list()) {
    groups.set(module.category, [...(groups.get(module.category) ?? []), module]);
  }
  return [...groups.entries()];
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function safeDisplayName(registry: BlockRegistry, kind: BlockKind): string {
  try {
    return registry.get(kind).displayName;
  } catch {
    return kind;
  }
}

function BuilderWorkspace({
  boardId,
  initial,
  hasDraft,
  boardEdit,
}: {
  readonly boardId: string;
  readonly initial: BoardBundle;
  readonly hasDraft: boolean;
  /** Server-authoritative per-board edit permission (undefined while unknown). */
  readonly boardEdit: boolean | undefined;
}): ReactElement {
  const { scope, data, repository, expressions } = useBoardsEnvironment();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(builderReducer, initial, createBuilderState);
  const [clipboardCount, setClipboardCount] = useState(
    () => readSessionClipboard()?.blocks.length ?? 0,
  );
  const [pasteWarnings, setPasteWarnings] = useState<readonly string[]>([]);
  const bundle = state.history.present;
  const dirty = isDirty(state);
  const registry = coreBlockRegistry;
  const items = layoutFor(bundle.layout, state.breakpoint);
  const selectedBlock = bundle.definition.blocks.find((b) => b.id === state.selectedId);
  const selectedItem = items.find((i) => i.blockId === state.selectedId);
  const multi = state.selectedIds.length > 1;
  const preview = usePositionPreview(boardId, bundle.definition.version);
  const devMode = useDevMode();
  const extensions = useBuilderExtensions();
  const codeAccess = resolveCodeAccess({
    devModeEnabled: devMode.enabled,
    editDefinitions: devMode.permissions.editDefinitions,
    editCode: devMode.permissions.editCode,
    boardEdit,
  });
  const [requestedMode, setMode] = useState<BuilderMode>("design");
  // Code mode only exists in dev mode; switching dev mode off returns to the visual builder.
  const mode: BuilderMode = codeAccess.visible ? requestedMode : "design";
  const codeMode = mode === "code";

  const context = useMemo<BlockRenderContext | null>(
    () =>
      scope
        ? {
            scope,
            boardId,
            definitionVersion: bundle.definition.version,
            mode: "builder",
            ...(preview.selectedPositionId
              ? { previewPositionId: preview.selectedPositionId }
              : {}),
          }
        : null,
    [scope, boardId, bundle.definition.version, preview.selectedPositionId],
  );

  const edit = useCallback(
    (next: BoardBundle, options?: { key?: string; announce?: string }) =>
      dispatch({
        type: "edit",
        next,
        at: Date.now(),
        ...(options?.key ? { key: options.key } : {}),
        ...(options?.announce ? { announce: options.announce } : {}),
      }),
    [],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("No scope");
      const toSave = state.history.present;
      const result = await repository.saveDraft({
        scope,
        boardId,
        baseVersion: state.baseVersion,
        bundle: toSave,
      });
      return { version: result.version, bundle: toSave };
    },
    onSuccess: ({ version, bundle: saved }) => {
      dispatch({ type: "saved", version, bundle: saved });
      void queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const addFromPalette = (kind: BlockKind, cell?: { x: number; y: number }): void => {
    const module = registry.get(kind);
    const id = crypto.randomUUID();
    let next = addBlock(bundle, kind, module.displayName, id);
    if (cell) {
      const placed = layoutFor(next.layout, state.breakpoint).find((i) => i.blockId === id);
      if (placed)
        next = moveBlockTo(next, state.breakpoint, id, { ...placed, x: cell.x, y: cell.y });
    }
    edit(next, { announce: `Added ${module.displayName}.` });
    dispatch({ type: "select", id });
  };

  const selection = state.selectedIds;
  const blockName = (id: string): string =>
    bundle.definition.blocks.find((b) => b.id === id)?.name ?? id;

  const moveSelection = (
    ids: readonly string[],
    dx: number,
    dy: number,
    announce: string,
  ): void => {
    const moved = moveGroup(layoutFor(bundle.layout, state.breakpoint), new Set(ids), dx, dy);
    edit(
      { ...bundle, layout: withBreakpointItems(bundle.layout, state.breakpoint, moved) },
      { announce },
    );
  };

  const removeSelection = (ids: readonly string[]): void => {
    let next = bundle;
    for (const id of ids) next = removeBlock(next, id);
    edit(next, {
      announce: `Removed ${ids.length === 1 ? blockName(ids[0] ?? "") : `${ids.length} blocks`}. Press Ctrl+Z to undo.`,
    });
  };

  const copySelection = (): void => {
    const clip = copyBlocks(bundle, selection, boardId);
    if (!clip) return;
    writeSessionClipboard(clip);
    setClipboardCount(clip.blocks.length);
    dispatch({
      type: "announce",
      message: `Copied ${clip.blocks.length} block${clip.blocks.length === 1 ? "" : "s"}.`,
    });
  };

  const pasteClipboard = (clip = readSessionClipboard()): void => {
    if (!clip) return;
    const result = pasteBlocks(bundle, clip, () => crypto.randomUUID());
    setPasteWarnings(result.warnings);
    edit(result.bundle, {
      announce: `Pasted ${result.newIds.length} block${result.newIds.length === 1 ? "" : "s"}.`,
    });
    dispatch({ type: "select-many", ids: result.newIds });
  };

  const duplicateSelection = (): void => {
    const clip = copyBlocks(bundle, selection, boardId);
    if (clip) pasteClipboard(clip);
  };

  const onKeyDown = (event: globalThis.KeyboardEvent): void => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "s") {
      event.preventDefault();
      if (dirty && !save.isPending) save.mutate();
      return;
    }
    if (isEditable(event.target)) return;
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
    } else if (mod && key === "a") {
      event.preventDefault();
      dispatch({ type: "select-many", ids: items.filter((i) => !i.hidden).map((i) => i.blockId) });
    } else if (key === "escape" && selection.length > 0) {
      dispatch({ type: "select", id: null });
    }
  };

  // Workspace shortcuts listen on the window so they work wherever focus is (but not in fields).
  const keyHandler = useRef(onKeyDown);
  keyHandler.current = onKeyDown;
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent): void => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const hiddenItems = items.filter((i) => i.hidden);

  return (
    <PageContainer width="full">
      <div className="grid gap-(--argus-gap)">
        <PageHeader
          title={bundle.definition.name}
          breadcrumbs={[
            { label: "Boards", link: <Link to="/boards">Boards</Link> },
            {
              label: "Published board",
              link: (
                <Link to="/boards/$boardId" params={{ boardId }}>
                  {initial.definition.name}
                </Link>
              ),
            },
            { label: "Builder" },
          ]}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              {hasDraft || state.baseVersion !== initial.definition.version ? (
                <Badge tone="warning">Draft v{state.baseVersion}</Badge>
              ) : (
                <Badge>Published v{state.baseVersion} — no draft yet</Badge>
              )}
              <span role="status" aria-live="polite" className="text-fg-muted">
                {save.isPending ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
              </span>
            </span>
          }
          actions={
            <>
              <Button asChild variant="ghost">
                <Link to="/boards/$boardId" params={{ boardId }}>
                  View published
                </Link>
              </Button>
              {dirty ? (
                <Button disabled>Review &amp; publish (save first)</Button>
              ) : (
                <Button asChild variant="primary">
                  <Link to="/boards/$boardId/diff" params={{ boardId }}>
                    Review &amp; publish
                  </Link>
                </Button>
              )}
            </>
          }
        />

        <Card className="flex flex-wrap items-center gap-2 p-2">
          <div
            role="toolbar"
            aria-label="Builder actions"
            className="flex flex-wrap items-center gap-2"
          >
            <Tooltip content="Undo" shortcut={["Ctrl", "Z"]}>
              <Button
                size="sm"
                disabled={!canUndo(state.history)}
                onClick={() => dispatch({ type: "undo" })}
              >
                Undo
              </Button>
            </Tooltip>
            <Tooltip content="Redo" shortcut={["Ctrl", "Shift", "Z"]}>
              <Button
                size="sm"
                disabled={!canRedo(state.history)}
                onClick={() => dispatch({ type: "redo" })}
              >
                Redo
              </Button>
            </Tooltip>
            <Button size="sm" disabled={selection.length === 0} onClick={copySelection}>
              Copy
            </Button>
            <Button size="sm" disabled={clipboardCount === 0} onClick={() => pasteClipboard()}>
              Paste{clipboardCount > 0 ? ` (${clipboardCount})` : ""}
            </Button>
            <Button size="sm" disabled={selection.length === 0} onClick={duplicateSelection}>
              Duplicate
            </Button>
            <Button
              size="sm"
              disabled={!dirty}
              onClick={() => edit(state.savedBundle, { announce: "Reverted to last saved draft." })}
            >
              Revert to saved
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save draft
            </Button>
          </div>
          <span className="flex-1" />
          {codeAccess.visible ? <ModeSwitch value={mode} onChange={setMode} /> : null}
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-fg-muted" id="boards-layout-label">
              Layout for
            </span>
            <Select
              size="sm"
              aria-label="Layout breakpoint"
              value={state.breakpoint}
              onValueChange={(value) =>
                dispatch({ type: "breakpoint", value: value as LayoutBreakpoint })
              }
              options={breakpoints.map((bp) => ({ value: bp.value, label: bp.label }))}
            />
          </div>
        </Card>

        {save.isError ? (
          <ErrorState title="Draft not saved" error={save.error} onRetry={() => save.mutate()} />
        ) : null}
        {pasteWarnings.length > 0 ? (
          <div className="rounded-md border border-warning bg-warning-subtle p-3" role="status">
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

        {codeMode ? (
          <p className="text-fg-muted">
            Code mode: edit the whole board as JSON in the centre, or pick a block and use the{" "}
            <strong>Code</strong> tab in Properties. Apply is one undo step; invalid code is never
            applied.
            {codeAccess.editable ? "" : " Your position can view code but not change it."}
          </p>
        ) : (
          <p className="text-fg-muted">
            Keyboard: focus a block, then <Kbd>Alt</Kbd>+arrows move it, <Kbd>Alt</Kbd>+
            <Kbd>Shift</Kbd>
            +arrows resize it, <Kbd>Delete</Kbd> removes it. <Kbd>Shift</Kbd>/<Kbd>Ctrl</Kbd>+click
            or <Kbd>Ctrl</Kbd>+<Kbd>A</Kbd> selects several; <Kbd>Ctrl</Kbd>+<Kbd>C</Kbd> /{" "}
            <Kbd>V</Kbd> / <Kbd>D</Kbd> copy, paste, duplicate; <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undoes;{" "}
            <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> saves. The properties panel has numeric and button controls
            for every move and resize.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {state.announcement}
        </p>

        <div className="boards-builder" data-mode={mode}>
          <nav
            aria-label={codeMode ? "Board blocks" : "Block palette"}
            className="boards-pane boards-pane-sticky"
          >
            <Panel title="Blocks" headingLevel={2}>
              {codeMode ? (
                <BlockPicker
                  blocks={bundle.definition.blocks}
                  selectedId={state.selectedId}
                  onSelect={(id) => dispatch({ type: "select", id })}
                />
              ) : (
                <div className="grid gap-3">
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
                          draggable
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
                            aria-label={`Add ${module.displayName} to board`}
                            onClick={() => addFromPalette(module.kind)}
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </Panel>
          </nav>

          <div className="boards-pane boards-code-pane">
            {codeMode ? (
              <Panel title="Board code" headingLevel={2}>
                <BundleCodeView bundle={bundle} editable={codeAccess.editable} onEdit={edit} />
              </Panel>
            ) : null}
            {!codeMode && context ? (
              <BuilderCanvas
                bundle={bundle}
                items={items}
                breakpoint={state.breakpoint}
                selectedId={state.selectedId}
                selectedIds={state.selectedIds}
                previewHiddenIds={preview.hiddenBlockIds}
                {...(preview.selectedLabel ? { previewLabel: preview.selectedLabel } : {})}
                registry={registry}
                context={context}
                data={data}
                onSelect={(id, additive) =>
                  dispatch({ type: "select", id, toggle: additive === true })
                }
                onPlace={(id, rect, announce) =>
                  edit(moveBlockTo(bundle, state.breakpoint, id, rect), { announce })
                }
                onMoveGroup={moveSelection}
                onNudge={(id, delta, announce) => {
                  const groupMove =
                    selection.length > 1 &&
                    selection.includes(id) &&
                    delta.dw === undefined &&
                    delta.dh === undefined;
                  if (groupMove) {
                    moveSelection(selection, delta.dx ?? 0, delta.dy ?? 0, announce);
                  } else {
                    edit(nudgeBlock(bundle, state.breakpoint, id, delta), { announce });
                  }
                }}
                onRemove={(id) => removeSelection(selection.includes(id) ? selection : [id])}
                onDropKind={addFromPalette}
              />
            ) : null}
            {!codeMode && hiddenItems.length > 0 ? (
              <Panel title={`Hidden on ${state.breakpoint}`} headingLevel={2}>
                <ul className="grid gap-2">
                  {hiddenItems.map((item) => (
                    <li key={item.blockId} className="flex items-center justify-between gap-2">
                      {blockName(item.blockId)}
                      <Button
                        size="sm"
                        onClick={() =>
                          edit(setBlockHidden(bundle, state.breakpoint, item.blockId, false), {
                            announce: `${blockName(item.blockId)} shown.`,
                          })
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

          <div className="boards-pane boards-pane-sticky">
            <Panel title="Properties" headingLevel={2}>
              {multi ? (
                <section className="grid gap-2" aria-label="Selection">
                  <p>
                    <strong>{selection.length} blocks selected</strong>
                  </p>
                  <ul className="list-disc ps-5 text-fg-muted">
                    {selection.map((id) => (
                      <li key={id}>{blockName(id)}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={copySelection}>
                      Copy
                    </Button>
                    <Button size="sm" onClick={duplicateSelection}>
                      Duplicate
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeSelection(selection)}>
                      Remove {selection.length} blocks
                    </Button>
                  </div>
                  <p className="text-xs text-fg-muted">
                    Drag any selected block, or use Alt+arrows, to move the group. Select a single
                    block to edit its properties.
                  </p>
                </section>
              ) : (
                <Inspector
                  key={state.selectedId ?? "board"}
                  bundle={bundle}
                  block={selectedBlock}
                  item={selectedItem}
                  breakpoint={state.breakpoint}
                  validator={expressions}
                  displayName={selectedBlock ? safeDisplayName(registry, selectedBlock.type) : ""}
                  onEdit={edit}
                  {...(codeAccess.visible ? { code: { editable: codeAccess.editable } } : {})}
                  {...(codeAccess.canEject && extensions.ejectBlock
                    ? { onEjectBlock: extensions.ejectBlock }
                    : {})}
                />
              )}
            </Panel>
            <Panel title="Preview" headingLevel={2}>
              <PositionPreviewControl preview={preview} />
            </Panel>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Board builder: three panes (palette, live canvas, inspector) over a draft with undo/redo,
 * multi-select, copy/paste between boards (same tab) and "preview as position".
 * Input: `boardId` route param; the draft (or the published definition when no draft exists).
 * Output: editable workspace; saving writes a draft with an optimistic base version.
 * Errors: load/save failures are explicit; publishing is only reachable through the diff review.
 * Depends on: BoardsRepositoryPort, BoardDataPort, ExpressionValidationPort, AuthorizationPreviewPort.
 */
export function BoardBuilderPage(): ReactElement {
  const boardId = useBoardIdParam();
  const { scope } = useBoardsEnvironment();
  const draft = useDraftBoard(boardId);
  const published = usePublishedBoard(boardId);
  const summary = useBoardSummary(boardId);

  const shell = (child: ReactElement): ReactElement => (
    <PageContainer width="wide">
      <PageHeader title="Board builder" />
      {child}
    </PageContainer>
  );

  if (!scope) return shell(<NoScopeState />);
  if (summary && !summary.permissions.edit) {
    return shell(
      <ErrorState
        title="You cannot edit this board"
        error={new Error("Your position does not have edit access.")}
      />,
    );
  }
  if (draft.isError) {
    return shell(
      <ErrorState
        title="Could not load the draft"
        error={draft.error}
        onRetry={() => void draft.refetch()}
      />,
    );
  }
  if (draft.data === null && published.isError) {
    return shell(
      <ErrorState
        title="Could not load the board"
        error={published.error}
        onRetry={() => void published.refetch()}
      />,
    );
  }
  const initial = draft.data ?? published.data;
  if (draft.isPending || !initial) {
    return shell(<LoadingState label="Loading board builder" />);
  }
  return (
    <BuilderWorkspace
      key={boardId}
      boardId={boardId}
      initial={initial}
      hasDraft={draft.data !== null && draft.data !== undefined}
      boardEdit={summary?.permissions.edit}
    />
  );
}
