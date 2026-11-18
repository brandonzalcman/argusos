import type { WorkflowEdge, WorkflowStep, WorkflowTrigger } from "@argus/schema";
import { Badge, Panel, Tabs, TabsContent, TabsList, TabsTrigger } from "@argus/ui";
import { CircleCheck, TriangleAlert } from "@argus/ui/icons";
import { type ReactElement, useState } from "react";
import { GraphCanvas } from "./graph-canvas.js";
import { GraphEditor } from "./graph-editor.js";
import type { EdgeBranch, GraphIssue } from "./graph.js";

type GraphMode = "canvas" | "outline";
const STORAGE_KEY = "argus.workflow-graph-mode";

function readStoredMode(): GraphMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "outline" ? "outline" : "canvas";
  } catch {
    return "canvas";
  }
}

function storeMode(mode: GraphMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage may be blocked; the mode simply is not remembered.
  }
}

export interface WorkflowGraphProps {
  readonly trigger: WorkflowTrigger;
  readonly steps: readonly WorkflowStep[];
  readonly edges: readonly WorkflowEdge[];
  readonly issues: readonly GraphIssue[];
  readonly selectedId: string;
  readonly readOnly?: boolean;
  readonly onSelect: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onConnect: (sourceStepId: string, branch: EdgeBranch, targetStepId: string | null) => void;
  readonly onRequestDelete: (stepId: string) => void;
}

/**
 * Step graph with a visual node canvas and a keyboard/screen-reader outline of the same draft.
 * The two views share selection, so an edit in one is visible in the other and in the inspector.
 * The outline is the WCAG 2.2 AA path for operating the graph without a pointer.
 */
export function WorkflowGraph({
  onConnect,
  onEdit,
  ...graph
}: WorkflowGraphProps): ReactElement {
  const [mode, setMode] = useState<GraphMode>(readStoredMode);
  const change = (next: string): void => {
    const value: GraphMode = next === "outline" ? "outline" : "canvas";
    setMode(value);
    storeMode(value);
  };
  return (
    <Tabs value={mode} onValueChange={change} className="grid gap-3">
      <TabsList aria-label="Graph view">
        <TabsTrigger value="canvas">Canvas</TabsTrigger>
        <TabsTrigger value="outline">Outline (keyboard)</TabsTrigger>
      </TabsList>
      <TabsContent value="canvas" className="grid gap-3">
        <Panel
          title="Step graph"
          description="Drag from a branch dot to a step to connect it; select a connection and press Delete to remove it. Switch to Outline for full keyboard editing."
          status={
            graph.issues.length > 0 ? (
              <Badge tone="critical" icon={<TriangleAlert />}>
                {graph.issues.length} {graph.issues.length === 1 ? "problem" : "problems"}
              </Badge>
            ) : (
              <Badge tone="success" icon={<CircleCheck />}>
                Graph valid
              </Badge>
            )
          }
          bodyClassName="grid gap-3"
        >
          <GraphCanvas {...graph} onConnect={onConnect} />
          {graph.issues.length > 0 ? (
            <ul aria-label="Graph problems" className="grid gap-1">
              {graph.issues.map((issue) => (
                <li
                  key={`${issue.code}-${issue.stepId ?? issue.message}`}
                  className="flex items-start gap-1.5 text-sm font-medium text-critical"
                >
                  <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </TabsContent>
      <TabsContent value="outline">
        <GraphEditor {...graph} onEdit={onEdit} />
      </TabsContent>
    </Tabs>
  );
}
