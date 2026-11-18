import type { WorkflowDefinition, WorkflowRun } from "@argus/schema";
import { createContext, useContext } from "react";
import type { ActorContext, AppScope } from "../../services/contracts.js";

export type { WorkflowDryRunResult, WorkflowDryRunStep } from "./local-types.js";
import type { WorkflowDryRunResult } from "./local-types.js";

export interface SaveWorkflowDraftRequest {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly expectedVersion: number;
  readonly definition: WorkflowDefinition;
}

export interface WorkflowDryRunRequest {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly workflowId: string;
  readonly definitionVersion: number;
  readonly sampleRecord: Readonly<Record<string, unknown>>;
}

/** Thrown by saveDraft when expectedVersion is stale; carries the winning server definition. */
export class WorkflowVersionConflictError extends Error {
  readonly serverDefinition: WorkflowDefinition;
  constructor(serverDefinition: WorkflowDefinition) {
    super("The workflow was changed by someone else.");
    this.name = "WorkflowVersionConflictError";
    this.serverDefinition = serverDefinition;
  }
}

/** Typed boundary to the workflow API. All calls are tenant/incident scoped. */
export interface WorkflowServicePort {
  readonly listWorkflows: (scope: AppScope) => Promise<readonly WorkflowDefinition[]>;
  readonly getWorkflow: (scope: AppScope, workflowId: string) => Promise<WorkflowDefinition | null>;
  readonly listRuns: (scope: AppScope, workflowId: string) => Promise<readonly WorkflowRun[]>;
  readonly saveDraft: (request: SaveWorkflowDraftRequest) => Promise<WorkflowDefinition>;
  readonly dryRun: (request: WorkflowDryRunRequest) => Promise<WorkflowDryRunResult>;
}

function notImplemented(method: string): Promise<never> {
  return Promise.reject(new Error(`TODO(implementation): WorkflowServicePort.${method}`));
}

/**
 * TODO(implementation): connect to the apps/api workflow endpoints and the Electric live shape.
 * Input: scoped requests per method. Output: a port whose methods reject until implemented.
 * Errors: every method rejects with TODO(implementation); future saveDraft rejects with
 * WorkflowVersionConflictError on a stale expectedVersion.
 * Depends on: apps/api workflow routes, workflow_runs sync, Graphile Worker dry-run support.
 */
export function createWorkflowServiceStub(): WorkflowServicePort {
  return {
    listWorkflows: () => notImplemented("listWorkflows"),
    getWorkflow: () => notImplemented("getWorkflow"),
    listRuns: () => notImplemented("listRuns"),
    saveDraft: () => notImplemented("saveDraft"),
    dryRun: () => notImplemented("dryRun"),
  };
}

const defaultService = createWorkflowServiceStub();
const WorkflowServiceContext = createContext<WorkflowServicePort>(defaultService);

/** Provider to inject a real or test workflow service. */
export const WorkflowServiceProvider = WorkflowServiceContext.Provider;

/** Returns the injected workflow service (the throwing stub by default). */
export function useWorkflowService(): WorkflowServicePort {
  return useContext(WorkflowServiceContext);
}
