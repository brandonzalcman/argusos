import type { WorkflowDefinition, WorkflowStep } from "@argus/schema";
import {
  Badge,
  Button,
  ConfirmDialog,
  ConflictBanner,
  Field,
  PageContainer,
  PageHeader,
  Panel,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@argus/ui";
import { CircleDot, Plus, Rocket, Save, SearchX, TriangleAlert } from "@argus/ui/icons";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { DryRunPanel } from "./dry-run-panel.js";
import { useFeatureSession } from "./feature-scope.js";
import {
  createStep,
  removeStep,
  STEP_TYPE_LABELS,
  type StepType,
  setConnection,
  validateGraph,
} from "./graph.js";
import { TRIGGER_NODE_ID } from "./graph-editor.js";
import { NodeInspector } from "./node-inspector.js";
import { RunHistoryPanel } from "./run-history.js";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  type SaveState,
  SaveStatus,
  SessionUnavailable,
} from "./status-views.js";
import { WorkflowGraph } from "./workflow-graph.js";
import { useSaveWorkflowDraft, useWorkflow } from "./workflow-queries.js";
import { WorkflowVersionConflictError } from "./workflow-service.js";
import { LifecyclePill } from "./workflows-list.js";

export interface WorkflowEditorProps {
  readonly workflow: WorkflowDefinition;
  readonly readOnly?: boolean;
}

/**
 * Editing surface for one loaded workflow: graph, inspector, save, run history and dry run.
 * Input: the server definition. Output: local draft saved with expectedVersion = definition.version.
 * Errors: version conflicts show both values with keep-mine / keep-theirs; other failures show the error.
 */
export function WorkflowEditor({ workflow, readOnly = false }: WorkflowEditorProps): ReactElement {
  const [draft, setDraft] = useState<WorkflowDefinition>(workflow);
  const [baseVersion, setBaseVersion] = useState(workflow.version);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(TRIGGER_NODE_ID);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [newType, setNewType] = useState<StepType>("condition");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<unknown>(null);
  const [conflict, setConflict] = useState<WorkflowDefinition | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const save = useSaveWorkflowDraft();

  // Adopt newer server versions only when the user has no unsaved edits.
  useEffect(() => {
    if (!dirty && workflow.version !== baseVersion) {
      setDraft(workflow);
      setBaseVersion(workflow.version);
    }
  }, [workflow, dirty, baseVersion]);

  const issues = validateGraph(draft.steps, draft.edges);
  const edit = (next: Partial<WorkflowDefinition>): void => {
    setDraft((current) => ({ ...current, ...next }));
    setDirty(true);
    setSaveState("idle");
  };

  const onAddStep = (): void => {
    const step = createStep(newType, crypto.randomUUID());
    edit({ steps: [...draft.steps, step] });
    setSelectedId(step.id);
  };

  const onStepChange = (step: WorkflowStep): void =>
    edit({ steps: draft.steps.map((s) => (s.id === step.id ? step : s)) });

  const onConnect = (
    stepId: string,
    branch: Parameters<typeof setConnection>[2],
    target: string | null,
  ): void =>
    edit({ edges: setConnection(draft.edges, stepId, branch, target, crypto.randomUUID()) });

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    const next = removeStep(draft.steps, draft.edges, pendingDelete);
    edit(next);
    setSelectedId(TRIGGER_NODE_ID);
    setPendingDelete(null);
  };

  const onSave = (): void => {
    setSaveState("saving");
    save.mutate(
      { expectedVersion: baseVersion, definition: draft },
      {
        onSuccess: (saved) => {
          setDraft(saved);
          setBaseVersion(saved.version);
          setDirty(false);
          setConflict(null);
          setSaveState("saved");
        },
        onError: (error) => {
          if (error instanceof WorkflowVersionConflictError) {
            setConflict(error.serverDefinition);
            setSaveState("conflict");
          } else {
            setSaveError(error);
            setSaveState("error");
          }
        },
      },
    );
  };

  const deleting = draft.steps.find((s) => s.id === pendingDelete);

  return (
    <PageContainer width="full">
      <PageHeader
        title={draft.name}
        description={`Workflow editor · saved version ${baseVersion}`}
        breadcrumbs={[
          {
            label: "Workflows",
            link: (
              <Link to="/workflows" className="rounded-sm hover:underline">
                Workflows
              </Link>
            ),
          },
          { label: draft.name },
        ]}
        meta={
          <>
            <LifecyclePill lifecycle={draft.lifecycle} />
            {dirty ? (
              <Badge tone="warning" icon={<CircleDot />} role="status">
                Unsaved changes
              </Badge>
            ) : null}
            <SaveStatus state={saveState} error={saveError} />
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Save aria-hidden="true" />}
              onClick={onSave}
              disabled={readOnly || !dirty}
              loading={save.isPending}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Rocket aria-hidden="true" />}
              onClick={() => setConfirmPublish(true)}
              disabled={readOnly || dirty || issues.length > 0 || draft.lifecycle === "published"}
              title={
                dirty
                  ? "Save the draft before publishing"
                  : issues.length > 0
                    ? "Fix graph problems before publishing"
                    : undefined
              }
            >
              Publish
            </Button>
          </>
        }
      />
      {publishNotice ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-border bg-warning-subtle p-3 text-sm text-fg"
        >
          <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-warning" />
          {publishNotice}
        </p>
      ) : null}
      {conflict ? (
        <div className="grid gap-3">
          <ConflictBanner
            recordLabel={draft.name}
            fields={[
              {
                fieldId: "steps",
                fieldLabel: "Steps",
                localValue: `${draft.steps.length} steps`,
                serverValue: `${conflict.steps.length} steps (version ${conflict.version})`,
              },
              {
                fieldId: "name",
                fieldLabel: "Name",
                localValue: draft.name,
                serverValue: conflict.name,
              },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(conflict);
                setBaseVersion(conflict.version);
                setDirty(false);
                setConflict(null);
                setSaveState("idle");
              }}
            >
              Keep theirs
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setBaseVersion(conflict.version);
                setConflict(null);
                setSaveState("idle");
              }}
            >
              Keep mine (rebase onto version {conflict.version})
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete step"
        itemName={deleting?.name ?? ""}
        description="The step and its connections are removed from this draft. Save the draft to keep the change."
        confirmLabel="Delete step"
        destructive
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish workflow"
        itemName={draft.name}
        description={`Publishing version ${baseVersion} makes it the definition that triggers run. Published versions are immutable and audited.`}
        confirmLabel="Publish workflow"
        onConfirm={() => {
          // TODO(implementation): call WorkflowServicePort.publish(expectedVersion) once it exists.
          setPublishNotice(
            "Publishing is not connected to the API yet (TODO(implementation): WorkflowServicePort.publish). Nothing was published.",
          );
          setConfirmPublish(false);
        }}
      />
      <div className="grid items-start gap-(--argus-gap) xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 gap-(--argus-gap)">
          <WorkflowGraph
            trigger={draft.trigger}
            steps={draft.steps}
            edges={draft.edges}
            issues={issues}
            selectedId={selectedId}
            readOnly={readOnly}
            onSelect={setSelectedId}
            onEdit={() => inspectorHeading.current?.focus()}
            onConnect={onConnect}
            onRequestDelete={setPendingDelete}
          />
          {readOnly ? null : (
            <Panel title="Add step">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="New step type" className="w-60">
                  <Select
                    value={newType}
                    onValueChange={(next) => setNewType(next as StepType)}
                    options={(Object.keys(STEP_TYPE_LABELS) as StepType[]).map((type) => ({
                      value: type,
                      label: STEP_TYPE_LABELS[type],
                    }))}
                  />
                </Field>
                <Button
                  variant="secondary"
                  leadingIcon={<Plus aria-hidden="true" />}
                  onClick={onAddStep}
                >
                  Add step
                </Button>
              </div>
            </Panel>
          )}
        </div>
        <div className="grid min-w-0 gap-(--argus-gap)">
          <NodeInspector
            selectedId={selectedId}
            trigger={draft.trigger}
            steps={draft.steps}
            edges={draft.edges}
            readOnly={readOnly}
            headingRef={inspectorHeading}
            onTriggerChange={(trigger) => edit({ trigger })}
            onStepChange={onStepChange}
            onConnect={(stepId, branch, target) =>
              edit({
                edges: setConnection(draft.edges, stepId, branch, target, crypto.randomUUID()),
              })
            }
            onRequestDelete={setPendingDelete}
          />
        </div>
        <div className="min-w-0 xl:col-span-2">
          <Panel title="Test and history">
            <Tabs defaultValue="dry-run">
              <TabsList aria-label="Test and history">
                <TabsTrigger value="dry-run">Test run (dry run)</TabsTrigger>
                <TabsTrigger value="runs">Run history</TabsTrigger>
              </TabsList>
              <TabsContent value="dry-run" className="pt-3">
                <DryRunPanel
                  workflowId={workflow.id}
                  savedVersion={baseVersion}
                  hasUnsavedChanges={dirty}
                />
              </TabsContent>
              <TabsContent value="runs" className="pt-3">
                <RunHistoryPanel workflowId={workflow.id} />
              </TabsContent>
            </Tabs>
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}

function WorkflowsBreadcrumbLink(): ReactElement {
  return (
    <Link to="/workflows" className="rounded-sm hover:underline">
      Workflows
    </Link>
  );
}

/**
 * Route-level container for /workflows/$workflowId with loading/not-found/error states.
 * Input: workflowId from the route. Output: the editor once the scoped definition loads.
 */
export function WorkflowEditorScreen({
  workflowId,
}: {
  readonly workflowId: string;
}): ReactElement {
  const session = useFeatureSession();
  const query = useWorkflow(workflowId);
  const shell = (body: ReactElement, title = "Workflow"): ReactElement => (
    <PageContainer>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "Workflows", link: <WorkflowsBreadcrumbLink /> }, { label: title }]}
      />
      {body}
    </PageContainer>
  );
  if (!session) return shell(<SessionUnavailable />);
  if (query.isPending) return shell(<LoadingSkeleton label="Loading workflow" />);
  if (query.isError) {
    return shell(
      <ErrorState
        title="Workflow failed to load"
        error={query.error}
        onRetry={() => void query.refetch()}
      />,
    );
  }
  if (query.data === null) {
    return shell(
      <div className="rounded-md border border-border bg-surface">
        <EmptyState
          icon={<SearchX />}
          title="Workflow not found"
          description="It does not exist or you are not allowed to see it in this scope."
          action={
            <Button asChild variant="secondary">
              <Link to="/workflows">Back to workflows</Link>
            </Button>
          }
        />
      </div>,
      "Workflow not found",
    );
  }
  return <WorkflowEditor key={query.data.id} workflow={query.data} />;
}
