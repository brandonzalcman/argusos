import { CodeEditor, type CodeEditorHandle } from "@argus/code-editor";
import {
  type CustomComponentDefinition,
  customComponentDefinitionSchema,
  type StudioDefinitionSummary,
} from "@argus/schema";
import type { SandboxFrameEvent } from "@argus/sdk/host";
import {
  Badge,
  Button,
  PageContainer,
  PageHeader,
  SplitPane,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@argus/ui";
import { CircleAlert, CircleCheck, Rocket, Save } from "@argus/ui/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useStudioPort } from "../../../services/studio.js";
import { DefinitionCodeView } from "../code-view.js";
import { useSessionSnapshot } from "../session.js";
import { statusLabel } from "../studio-links.js";
import { CapabilitiesEditor } from "./capabilities-editor.js";
import {
  appendEntry,
  type ConsoleEntry,
  frameEventToEntry,
  PREVIEW_DATA_NOT_CONNECTED,
} from "./console-model.js";
import { ConsolePanel } from "./console-panel.js";
import { compileProblems, lineColumnToOffset, problemsToDiagnostics } from "./diagnostics.js";
import {
  classifyStudioError,
  collectProblems,
  type EditorAccess,
  hasBlockingProblems,
  isDraftSaveable,
  isVersionConflict,
  newIdempotencyKey,
  type ProblemArea,
  resolveEditorAccess,
} from "./editor-model.js";
import {
  EditorBlocked,
  EditorLoadFailure,
  EditorLoading,
  MissingComponentId,
  ReadOnlyNotice,
} from "./editor-states.js";
import { createPreviewServices, PreviewPanel } from "./preview-panel.js";
import { PreviewValuesForm, PropsEditor } from "./props-editor.js";
import { resolvePreviewValues } from "./props-model.js";
import { PublishDialog } from "./publish-dialog.js";
import { VersionsMenu } from "./versions-menu.js";

type EditorTab = "source" | "props" | "capabilities" | "definition";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(DESKTOP_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** True at the desktop breakpoint; the server snapshot assumes desktop. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => globalThis.matchMedia?.(DESKTOP_QUERY).matches ?? true,
    () => true,
  );
}

export interface LoadedComponent {
  readonly summary: StudioDefinitionSummary;
  readonly version: number;
  readonly definition: CustomComponentDefinition;
  readonly revision: "draft" | "published";
}

/** Loads the working draft, falling back to the published version. Null when neither exists. */
export async function loadComponent(
  studio: ReturnType<typeof useStudioPort>,
  id: string,
): Promise<LoadedComponent | null> {
  for (const revision of ["draft", "published"] as const) {
    const result = await studio.get({ kind: "component", id, revision });
    if (result === null) continue;
    if (result.document.kind !== "component") {
      throw new Error("not-found: this definition is not a component");
    }
    return {
      summary: result.summary,
      version: result.version,
      definition: result.document.definition,
      revision,
    };
  }
  return null;
}

export const componentQueryKey = (id: string) =>
  ["studio", "get", "component", id, "editor"] as const;

/** `/studio/components/$componentId`. */
export function ComponentEditorPage(): ReactElement {
  const params = useParams({ strict: false });
  const componentId = typeof params.componentId === "string" ? params.componentId : "";
  return <ComponentEditor componentId={componentId} />;
}

function Shell({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <PageContainer width="full">
      <PageHeader
        eyebrow="Dev mode · Component"
        title="Component editor"
        description="Write a custom interface component in TSX and preview it in the secure sandbox."
      />
      {children}
    </PageContainer>
  );
}

export function ComponentEditor({ componentId }: { readonly componentId: string }): ReactElement {
  const studio = useStudioPort();
  const session = useSessionSnapshot();
  const [nonce, setNonce] = useState(0);
  const sessionAccess =
    session.snapshot === undefined ? null : resolveEditorAccess(session.snapshot, null);
  const query = useQuery({
    queryKey: componentQueryKey(componentId),
    enabled: componentId !== "" && sessionAccess?.state === "ready",
    retry: (count, error) => classifyStudioError(error) === "error" && count < 2,
    refetchOnWindowFocus: false,
    queryFn: () => loadComponent(studio, componentId),
  });

  if (componentId === "") {
    return (
      <Shell>
        <MissingComponentId />
      </Shell>
    );
  }
  if (session.loading || sessionAccess === null) {
    return (
      <Shell>
        <EditorLoading />
      </Shell>
    );
  }
  if (sessionAccess.state !== "ready") {
    return (
      <Shell>
        <EditorBlocked reason={sessionAccess.state} />
      </Shell>
    );
  }
  if (query.isLoading) {
    return (
      <Shell>
        <EditorLoading />
      </Shell>
    );
  }
  if (query.error || query.data === null || query.data === undefined) {
    const failure = query.error ? classifyStudioError(query.error) : "not-found";
    return (
      <Shell>
        <EditorLoadFailure
          failure={failure}
          message={query.error instanceof Error ? query.error.message : "Unknown error"}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </Shell>
    );
  }
  const loaded = query.data;
  const access = resolveEditorAccess(session.snapshot ?? null, loaded.summary.permissions);
  return (
    <Workspace
      key={`${componentId}:${nonce}`}
      componentId={componentId}
      loaded={loaded}
      access={access}
      onReload={async () => {
        await query.refetch();
        setNonce((n) => n + 1);
      }}
    />
  );
}

type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

interface WorkspaceProps {
  readonly componentId: string;
  readonly loaded: LoadedComponent;
  readonly access: EditorAccess;
  readonly onReload: () => Promise<void>;
}

function Workspace({ componentId, loaded, access, onReload }: WorkspaceProps): ReactElement {
  const studio = useStudioPort();
  const queryClient = useQueryClient();
  const readOnly = access.state !== "ready" || !access.canEdit;
  const canPublish = access.state === "ready" && access.canPublish;
  const readOnlyReason = access.state === "ready" ? access.readOnlyReason : null;

  const [draft, setDraft] = useState<CustomComponentDefinition>(loaded.definition);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(loaded.definition));
  const [baseVersion, setBaseVersion] = useState(loaded.version);
  const [tab, setTab] = useState<EditorTab>("source");
  const [consoleTab, setConsoleTab] = useState<"console" | "problems">("console");
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, unknown>>({});
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [debouncedSource, setDebouncedSource] = useState(draft.source);
  const editorRef = useRef<CodeEditorHandle>(null);
  const entryId = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(baseVersion);
  baseRef.current = baseVersion;
  const isDesktop = useIsDesktop();

  const dirty = JSON.stringify(draft) !== savedJson;

  // Compile diagnostics are debounced (~300 ms) so typing never waits on the compiler.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSource(draft.source), 300);
    return () => clearTimeout(timer);
  }, [draft.source]);
  const compile = useMemo(() => compileProblems(debouncedSource), [debouncedSource]);
  const diagnostics = useMemo(() => problemsToDiagnostics(compile), [compile]);
  const problems = useMemo(() => collectProblems(draft, compile), [draft, compile]);
  const blocking = hasBlockingProblems(problems);

  const previewValues = useMemo(
    () => resolvePreviewValues(draft.props, previewOverrides),
    [draft.props, previewOverrides],
  );

  const pushEntry = useCallback((build: (id: number) => ConsoleEntry | null) => {
    entryId.current += 1;
    const entry = build(entryId.current);
    if (entry) setEntries((current) => appendEntry(current, entry));
  }, []);

  const onFrameEvent = useCallback(
    (event: SandboxFrameEvent) => pushEntry((id) => frameEventToEntry(event, id)),
    [pushEntry],
  );

  const services = useMemo(
    () =>
      createPreviewServices((method) =>
        pushEntry((id) => ({
          id,
          level: "warn",
          origin: "preview",
          text: `${PREVIEW_DATA_NOT_CONNECTED} (${method})`,
          line: null,
          column: null,
        })),
      ),
    [pushEntry],
  );

  const jumpToSource = useCallback(
    (line: number | null, column: number | null, from: number | null) => {
      setTab("source");
      setTimeout(() => {
        const offset = from ?? lineColumnToOffset(draftRef.current.source, line, column);
        editorRef.current?.setSelection(offset, offset);
        editorRef.current?.focus();
      }, 0);
    },
    [],
  );

  const openArea = useCallback((area: ProblemArea) => setTab(area), []);

  const refreshQueries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["studio", "list", "component"] });
    await queryClient.invalidateQueries({
      queryKey: ["studio", "versions", "component", componentId],
    });
    await queryClient.invalidateQueries({ queryKey: componentQueryKey(componentId) });
  }, [queryClient, componentId]);

  const save = useMutation({
    mutationFn: async () => {
      const definition = draftRef.current;
      const result = await studio.saveDraft({
        id: componentId,
        baseVersion: baseRef.current,
        document: { kind: "component", definition },
      });
      return { result, definition };
    },
    onMutate: () => {
      setSaveState("saving");
      setSaveError(null);
    },
    onSuccess: async ({ result, definition }) => {
      setBaseVersion(result.version);
      setSavedJson(JSON.stringify(definition));
      setSaveState("saved");
      await refreshQueries();
    },
    onError: (error) => {
      if (isVersionConflict(error)) {
        setSaveState("conflict");
        setSaveError(null);
      } else {
        setSaveState("error");
        setSaveError(
          classifyStudioError(error) === "not-connected"
            ? "Studio isn't connected yet, so the draft can't be saved."
            : error instanceof Error
              ? error.message
              : "Couldn't save the draft.",
        );
      }
    },
  });

  const publish = useMutation({
    mutationFn: async (changeSummary: string) => {
      let version = baseRef.current;
      // Save first so the published version is exactly what is on screen.
      if (JSON.stringify(draftRef.current) !== savedJson) {
        const definition = draftRef.current;
        const saved = await studio.saveDraft({
          id: componentId,
          baseVersion: version,
          document: { kind: "component", definition },
        });
        version = saved.version;
        setBaseVersion(saved.version);
        setSavedJson(JSON.stringify(definition));
      }
      return studio.publish({
        kind: "component",
        id: componentId,
        expectedVersion: version,
        changeSummary,
        idempotencyKey: newIdempotencyKey("publish-component"),
      });
    },
    onSuccess: async () => {
      setPublishOpen(false);
      setSaveState("saved");
      await refreshQueries();
    },
  });

  const canSave = !readOnly && dirty && isDraftSaveable(draft) && !save.isPending;
  const runSave = useCallback(() => {
    if (!readOnly && !save.isPending && JSON.stringify(draftRef.current) !== savedJson) {
      if (isDraftSaveable(draftRef.current)) save.mutate();
    }
  }, [readOnly, save, savedJson]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      runSave();
    }
  };

  const status = statusLabel(loaded.summary);
  const hasUnpublished = dirty || loaded.summary.hasUnpublishedChanges;
  const publishDisabled = !canPublish || blocking || !hasUnpublished;
  const conflict = saveState === "conflict" || (publish.error && isVersionConflict(publish.error));
  const publishError =
    publish.error && !isVersionConflict(publish.error)
      ? classifyStudioError(publish.error) === "not-connected"
        ? "Studio isn't connected yet, so nothing can be published."
        : publish.error.message
      : null;

  const left = (
    <section aria-label="Component code and settings" className="grid min-w-0 gap-3">
      {readOnlyReason ? <ReadOnlyNotice reason={readOnlyReason} /> : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)}>
        <TabsList aria-label="Component editor sections">
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="props" count={draft.props.length}>
            Props
          </TabsTrigger>
          <TabsTrigger value="capabilities" count={draft.capabilities.length}>
            Capabilities
          </TabsTrigger>
          <TabsTrigger value="definition">Definition</TabsTrigger>
        </TabsList>
        <TabsContent value="source">
          <div className="grid gap-2">
            <p id="source-hint" className="text-sm text-fg-muted">
              TSX. Imports are limited to <code className="font-mono">react</code> and{" "}
              <code className="font-mono">@argus/component-sdk</code>. Ctrl/Cmd+S saves. Press Esc,
              then Tab to move focus out of the editor.
            </p>
            <CodeEditor
              ref={editorRef}
              aria-label="Component source (TSX)"
              language="tsx"
              value={draft.source}
              readOnly={readOnly}
              diagnostics={diagnostics}
              onChange={(source) => setDraft((d) => ({ ...d, source }))}
              onSave={() => runSave()}
              minHeight="22rem"
              maxHeight={isDesktop ? "calc(100dvh - 26rem)" : "70vh"}
            />
          </div>
        </TabsContent>
        <TabsContent value="props">
          <div className="grid gap-5">
            <PropsEditor
              props={draft.props}
              disabled={readOnly}
              onChange={(props) => setDraft((d) => ({ ...d, props }))}
            />
            <section aria-label="Preview values" className="grid gap-2">
              <h2 className="text-md font-semibold text-fg">Preview values</h2>
              <p className="text-sm text-fg-muted">
                Values passed to the preview only. They aren't saved with the component.
              </p>
              <PreviewValuesForm
                props={draft.props}
                values={previewOverrides}
                onChange={setPreviewOverrides}
              />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="capabilities">
          <CapabilitiesEditor
            capabilities={draft.capabilities}
            disabled={readOnly}
            onChange={(capabilities) => setDraft((d) => ({ ...d, capabilities }))}
          />
        </TabsContent>
        <TabsContent value="definition">
          <DefinitionCodeView
            value={draft}
            schema={customComponentDefinitionSchema}
            onApply={setDraft}
            label="Component definition (JSON)"
            editable={!readOnly}
            maxHeight={isDesktop ? "calc(100dvh - 26rem)" : "70vh"}
          />
        </TabsContent>
      </Tabs>
    </section>
  );

  const right = (
    <section aria-label="Preview and diagnostics" className="grid min-w-0 gap-3">
      <PreviewPanel
        name={draft.name}
        componentKey={draft.key}
        version={baseVersion}
        source={draft.source}
        props={previewValues}
        capabilities={draft.capabilities}
        declaredProps={draft.props}
        services={services}
        onEvent={onFrameEvent}
      />
      <ConsolePanel
        entries={entries}
        problems={problems}
        tab={consoleTab}
        onTabChange={setConsoleTab}
        onClear={() => setEntries([])}
        onJumpToSource={jumpToSource}
        onOpenArea={openArea}
      />
    </section>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: captures Ctrl/Cmd+S for the whole editor
    <div onKeyDown={onKeyDown}>
      <PageContainer width="full">
        <PageHeader
          eyebrow="Dev mode · Component"
          title={draft.name}
          description={draft.description ?? undefined}
          meta={
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={status.status} label={status.label} />
              <code className="font-mono text-sm text-fg-muted">{draft.key}</code>
              {draft.ejectedFrom ? (
                <Badge tone="neutral" variant="outline">
                  Ejected from {draft.ejectedFrom}
                </Badge>
              ) : null}
              <SaveIndicator state={saveState} dirty={dirty} readOnly={readOnly} />
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <VersionsMenu componentId={componentId} />
              <Button
                leadingIcon={<Save />}
                loading={save.isPending}
                disabled={!canSave}
                aria-keyshortcuts="Control+S Meta+S"
                onClick={runSave}
              >
                Save draft
              </Button>
              <Button
                variant="primary"
                leadingIcon={<Rocket />}
                disabled={publishDisabled}
                onClick={() => {
                  publish.reset();
                  setPublishOpen(true);
                }}
              >
                Publish
              </Button>
            </div>
          }
        />
        {saveError ? (
          <p role="alert" className="text-sm text-critical">
            {saveError}
          </p>
        ) : null}
        {!readOnly && dirty && !isDraftSaveable(draft) ? (
          <p role="status" className="text-sm text-fg-muted">
            The draft has schema problems (see Problems), so it can't be saved yet.
          </p>
        ) : null}
        {conflict ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-md border border-warning bg-warning-subtle p-3 text-sm text-fg"
          >
            <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
            <p className="min-w-0 flex-1">
              Someone else saved a newer version of this component. Reloading shows their version;
              your unsaved edits here would be discarded.
            </p>
            <Button size="sm" onClick={() => void onReload()}>
              Reload latest version
            </Button>
          </div>
        ) : null}
        {isDesktop ? (
          <div className="h-[calc(100dvh-16rem)] min-h-[36rem]">
            <SplitPane
              className="h-full"
              separatorLabel="Resize editor and preview"
              defaultSize={55}
              minSize={30}
              maxSize={75}
              first={<div className="h-full overflow-auto pe-3">{left}</div>}
              second={<div className="h-full overflow-auto ps-3">{right}</div>}
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {left}
            {right}
          </div>
        )}
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          componentName={draft.name}
          capabilities={draft.capabilities}
          pending={publish.isPending}
          error={publishError}
          onConfirm={(summary) => publish.mutate(summary)}
        />
      </PageContainer>
    </div>
  );
}

function SaveIndicator({
  state,
  dirty,
  readOnly,
}: {
  readonly state: SaveState;
  readonly dirty: boolean;
  readonly readOnly: boolean;
}): ReactElement {
  let content: ReactNode;
  if (readOnly)
    content = (
      <Badge tone="neutral" variant="outline">
        Read-only
      </Badge>
    );
  else if (state === "saving") content = "Saving…";
  else if (state === "conflict") {
    content = (
      <span className="inline-flex items-center gap-1 text-warning">
        <CircleAlert aria-hidden="true" className="size-4" /> Conflict
      </span>
    );
  } else if (dirty) content = "Unsaved changes";
  else if (state === "saved") {
    content = (
      <span className="inline-flex items-center gap-1 text-success">
        <CircleCheck aria-hidden="true" className="size-4" /> Saved
      </span>
    );
  } else content = "No changes";
  return (
    <span role="status" aria-live="polite" className="text-sm text-fg-muted">
      {content}
    </span>
  );
}
