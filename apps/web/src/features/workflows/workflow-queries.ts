import type { WorkflowDefinition } from "@argus/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FeatureSession, useFeatureSession } from "./feature-scope.js";
import { useWorkflowService, type WorkflowDryRunResult } from "./workflow-service.js";

/** Runs poll every five seconds until the Electric live shape replaces this (see AGENTS.md). */
const RUN_POLL_MS = 5_000;

function scopeKey(session: FeatureSession | null): readonly unknown[] {
  return ["workflows", session?.scope.tenantId ?? null, session?.scope.incidentId ?? null];
}

/** Lists authorized workflow definitions. Disabled without a session. */
export function useWorkflows() {
  const session = useFeatureSession();
  const service = useWorkflowService();
  return useQuery({
    queryKey: [...scopeKey(session), "list"],
    enabled: session !== null,
    queryFn: () => service.listWorkflows((session as FeatureSession).scope),
  });
}

/** Loads one workflow; resolves to null when not found or not visible. */
export function useWorkflow(workflowId: string) {
  const session = useFeatureSession();
  const service = useWorkflowService();
  return useQuery({
    queryKey: [...scopeKey(session), "detail", workflowId],
    enabled: session !== null,
    queryFn: () => service.getWorkflow((session as FeatureSession).scope, workflowId),
  });
}

/** Run history for one workflow with polling fallback. */
export function useWorkflowRuns(workflowId: string) {
  const session = useFeatureSession();
  const service = useWorkflowService();
  return useQuery({
    queryKey: [...scopeKey(session), "runs", workflowId],
    enabled: session !== null,
    refetchInterval: RUN_POLL_MS,
    queryFn: () => service.listRuns((session as FeatureSession).scope, workflowId),
  });
}

/** Saves a draft with the optimistic version; callers handle WorkflowVersionConflictError. */
export function useSaveWorkflowDraft() {
  const session = useFeatureSession();
  const service = useWorkflowService();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      readonly expectedVersion: number;
      readonly definition: WorkflowDefinition;
    }) => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return service.saveDraft({ ...session, ...input });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: scopeKey(session) }),
  });
}

/** Runs a side-effect-free dry run of a saved version. */
export function useWorkflowDryRun(workflowId: string) {
  const session = useFeatureSession();
  const service = useWorkflowService();
  return useMutation<
    WorkflowDryRunResult,
    Error,
    { readonly definitionVersion: number; readonly sampleRecord: Record<string, unknown> }
  >({
    mutationFn: (input) => {
      if (!session) return Promise.reject(new Error("No session scope available"));
      return service.dryRun({ ...session, workflowId, ...input });
    },
  });
}
