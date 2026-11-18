import type { WorkflowEdge, WorkflowStep, WorkflowTrigger } from "@argus/schema";
import { cn, useUIPreferences } from "@argus/ui";
import { GitBranch, TriangleAlert, Zap } from "@argus/ui/icons";
import {
  applyNodeChanges,
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { memo, type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  branchesFor,
  type EdgeBranch,
  entrySteps,
  type GraphIssue,
  layoutSteps,
  STEP_TYPE_LABELS,
  TRIGGER_TYPE_LABELS,
} from "./graph.js";
import { TRIGGER_NODE_ID } from "./graph-editor.js";
import "./workflow-canvas.css";

const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 170;

type NodeKind = "trigger" | "condition" | "action";

interface FlowNodeData extends Record<string, unknown> {
  readonly kind: NodeKind;
  readonly title: string;
  readonly subtitle: string;
  readonly branches: readonly EdgeBranch[];
  readonly hasIssue: boolean;
}

type FlowNode = Node<FlowNodeData, NodeKind>;

function BranchHandles({
  branches,
  hasIssue,
}: {
  readonly branches: readonly EdgeBranch[];
  readonly hasIssue: boolean;
}): ReactElement {
  void hasIssue;
  return (
    <div className="mt-2 grid gap-1 border-t border-border pt-2">
      {branches.map((branch) => (
        <div
          key={branch}
          className="relative flex h-5 items-center justify-end pe-4 font-mono text-xs text-fg-muted"
        >
          {branch}
          <Handle
            id={branch}
            type="source"
            position={Position.Right}
            className="argus-flow-handle"
            style={{ top: "50%" }}
            aria-label={`Connect the “${branch}” branch`}
          />
        </div>
      ))}
    </div>
  );
}

function nodeShell(selected: boolean, hasIssue: boolean): string {
  return cn(
    "w-60 rounded-md border bg-surface px-3 py-2.5 text-fg shadow-sm",
    hasIssue ? "border-critical" : selected ? "border-accent" : "border-border",
    selected && "bg-accent-subtle ring-2 ring-accent/40",
  );
}

const TriggerNode = memo(function TriggerNode({
  data,
  selected,
}: NodeProps<FlowNode>): ReactElement {
  return (
    <div className={nodeShell(selected, false)}>
      <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Trigger</p>
      <p className="flex items-center gap-2 font-medium">
        <Zap aria-hidden="true" className="size-4 text-accent-text" />
        {data.title}
      </p>
      {data.subtitle ? <p className="text-sm text-fg-muted">{data.subtitle}</p> : null}
      <Handle
        id="next"
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="argus-flow-handle"
      />
    </div>
  );
});

const StepNode = memo(function StepNode({ data, selected }: NodeProps<FlowNode>): ReactElement {
  const Icon = data.kind === "condition" ? GitBranch : null;
  return (
    <div className={nodeShell(selected, data.hasIssue)}>
      <Handle type="target" position={Position.Left} id="in" className="argus-flow-handle" />
      <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
        {data.kind === "condition" ? "Condition" : "Action"}
      </p>
      <p className="flex items-center justify-between gap-2 font-medium">
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-accent-text" /> : null}
          <span className="truncate">{data.title}</span>
        </span>
        {data.hasIssue ? (
          <span className="inline-flex items-center gap-1 text-sm text-critical">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Fix
          </span>
        ) : null}
      </p>
      <p className="text-sm text-fg-muted">{data.subtitle}</p>
      <BranchHandles branches={data.branches} hasIssue={data.hasIssue} />
    </div>
  );
});

const nodeTypes = { trigger: TriggerNode, condition: StepNode, action: StepNode };

export interface GraphCanvasProps {
  readonly trigger: WorkflowTrigger;
  readonly steps: readonly WorkflowStep[];
  readonly edges: readonly WorkflowEdge[];
  readonly issues: readonly GraphIssue[];
  readonly selectedId: string;
  readonly readOnly?: boolean;
  readonly onSelect: (id: string) => void;
  /** Connect (or, with a null target, disconnect) one branch of a step. */
  readonly onConnect: (
    sourceStepId: string,
    branch: EdgeBranch,
    targetStepId: string | null,
  ) => void;
  /** A step was deleted with the keyboard; the host confirms before removing it. */
  readonly onRequestDelete: (stepId: string) => void;
}

/**
 * Visual node canvas (React Flow) for the trigger → condition/action graph.
 * Drag from a branch handle to a step to connect; select an edge and press Delete to disconnect;
 * drag an edge end to reconnect. Node positions are session-only (TODO(decision): the schema has
 * no position field). The trigger feeds the single first step implicitly, so its link is read-only.
 * This canvas is a visual aid: Outline mode offers the complete keyboard path.
 */
export function GraphCanvas({
  trigger,
  steps,
  edges,
  issues,
  selectedId,
  readOnly = false,
  onSelect,
  onConnect,
  onRequestDelete,
}: GraphCanvasProps): ReactElement {
  const { resolvedTheme } = useUIPreferences();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Readonly<Record<string, { x: number; y: number }>>>(
    {},
  );
  const issueIds = useMemo(() => new Set(issues.map((i) => i.stepId).filter(Boolean)), [issues]);

  const baseNodes = useMemo<FlowNode[]>(() => {
    const laidOut = layoutSteps(steps, edges);
    const rowByDepth = new Map<number, number>();
    const stepNodes = laidOut.map(({ step, depth }): FlowNode => {
      const row = rowByDepth.get(depth) ?? 0;
      rowByDepth.set(depth, row + 1);
      return {
        id: step.id,
        type: step.type === "condition" ? "condition" : "action",
        position: positions[step.id] ?? { x: depth * COLUMN_WIDTH, y: row * ROW_HEIGHT },
        selected: selectedEdgeId === null && step.id === selectedId,
        deletable: !readOnly,
        draggable: true,
        ariaLabel: `${STEP_TYPE_LABELS[step.type]}: ${step.name}`,
        data: {
          kind: step.type === "condition" ? "condition" : "action",
          title: step.name,
          subtitle: STEP_TYPE_LABELS[step.type],
          branches: branchesFor(step.type),
          hasIssue: issueIds.has(step.id),
        },
      };
    });
    const triggerNode: FlowNode = {
      id: TRIGGER_NODE_ID,
      type: "trigger",
      position: positions[TRIGGER_NODE_ID] ?? { x: 0, y: 0 },
      selected: selectedEdgeId === null && selectedId === TRIGGER_NODE_ID,
      deletable: false,
      ariaLabel: `Trigger: ${TRIGGER_TYPE_LABELS[trigger.type]}`,
      data: {
        kind: "trigger",
        title: TRIGGER_TYPE_LABELS[trigger.type],
        subtitle: "",
        branches: [],
        hasIssue: false,
      },
    };
    return [triggerNode, ...stepNodes];
  }, [steps, edges, trigger.type, positions, selectedId, selectedEdgeId, issueIds, readOnly]);

  const [nodes, setNodes] = useState<FlowNode[]>(baseNodes);
  useEffect(() => setNodes(baseNodes), [baseNodes]);

  const flowEdges = useMemo<Edge[]>(() => {
    const real = edges.map(
      (edge): Edge => ({
        id: edge.id,
        source: edge.sourceStepId,
        target: edge.targetStepId,
        sourceHandle: edge.branch,
        targetHandle: "in",
        ...(edge.branch === "next" ? {} : { label: edge.branch }),
        selected: edge.id === selectedEdgeId,
        deletable: !readOnly,
        reconnectable: !readOnly,
        ...(edge.branch === "failed" ? { className: "argus-flow-edge-failed" } : {}),
        markerEnd: { type: MarkerType.ArrowClosed },
        ariaLabel: `${edge.branch} connection`,
      }),
    );
    const implicit = entrySteps(steps, edges).map(
      (step): Edge => ({
        id: `entry-${step.id}`,
        source: TRIGGER_NODE_ID,
        sourceHandle: "next",
        target: step.id,
        targetHandle: "in",
        deletable: false,
        selectable: false,
        reconnectable: false,
        focusable: false,
        className: "argus-flow-edge-implicit",
        markerEnd: { type: MarkerType.ArrowClosed },
      }),
    );
    return [...implicit, ...real];
  }, [steps, edges, readOnly, selectedEdgeId]);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const applied: NodeChange<FlowNode>[] = [];
      for (const change of changes) {
        if (change.type === "remove") {
          if (!readOnly && change.id !== TRIGGER_NODE_ID) onRequestDelete(change.id);
          continue;
        }
        if (change.type === "select") continue; // selection is owned by the host (selectedId)
        applied.push(change);
        if (change.type === "position" && change.dragging === false && change.position) {
          const { id, position } = change;
          setPositions((current) => ({ ...current, [id]: position }));
        }
      }
      if (applied.length > 0) setNodes((current) => applyNodeChanges(applied, current));
    },
    [onRequestDelete, readOnly],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      for (const change of changes) {
        if (change.type !== "remove") continue;
        const edge = edges.find((e) => e.id === change.id);
        if (edge) onConnect(edge.sourceStepId, edge.branch, null);
      }
    },
    [edges, onConnect, readOnly],
  );

  const onConnectEdge = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.sourceHandle || connection.source === TRIGGER_NODE_ID) return;
      onConnect(connection.source, connection.sourceHandle as EdgeBranch, connection.target);
    },
    [onConnect, readOnly],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      if (readOnly || !connection.sourceHandle) return;
      const old = edges.find((e) => e.id === oldEdge.id);
      if (
        old &&
        (old.sourceStepId !== connection.source || old.branch !== connection.sourceHandle)
      ) {
        onConnect(old.sourceStepId, old.branch, null);
      }
      onConnect(connection.source, connection.sourceHandle as EdgeBranch, connection.target);
    },
    [edges, onConnect, readOnly],
  );

  return (
    <div
      className="argus-flow h-[26rem] min-h-72 overflow-hidden rounded-md border border-border bg-surface-sunken"
      data-testid="workflow-canvas"
    >
      <ReactFlow
        aria-label="Workflow canvas"
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme === "light" ? "light" : "dark"}
        defaultViewport={{ x: 24, y: 24, zoom: 0.9 }}
        minZoom={0.25}
        maxZoom={1.75}
        nodesConnectable={!readOnly}
        connectionMode={ConnectionMode.Strict}
        isValidConnection={(connection) =>
          connection.source !== connection.target && connection.source !== TRIGGER_NODE_ID
        }
        deleteKeyCode={["Delete", "Backspace"]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnectEdge}
        onReconnect={onReconnect}
        onNodeClick={(_event, node) => {
          setSelectedEdgeId(null);
          onSelect(node.id);
        }}
        onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
        onPaneClick={() => {
          setSelectedEdgeId(null);
          onSelect(TRIGGER_NODE_ID);
        }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          style={{ width: 150, height: 96 }}
          zoomable
          ariaLabel="Workflow minimap"
          nodeClassName={(node) => `argus-flow-minimap-${(node.type ?? "action") as string}`}
        />
      </ReactFlow>
    </div>
  );
}
