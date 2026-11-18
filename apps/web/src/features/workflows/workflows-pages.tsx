import { EmptyState, PageContainer, PageHeader } from "@argus/ui";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { WorkflowEditorScreen } from "./workflow-editor.js";
import { WorkflowsListScreen } from "./workflows-list.js";

/** Route component for /workflows. */
export function WorkflowsPage(): ReactElement {
  return <WorkflowsListScreen />;
}

/**
 * Route component for /workflows/$workflowId.
 * Input: workflowId from the router. Output: the editor, remounted per workflow id.
 */
export function WorkflowEditorPage(): ReactElement {
  const { workflowId } = useParams({ strict: false });
  if (!workflowId) {
    return (
      <PageContainer>
        <PageHeader title="Workflow not specified" />
        <EmptyState title="No workflow selected" description="Open a workflow from the list." />
      </PageContainer>
    );
  }
  return <WorkflowEditorScreen key={workflowId} workflowId={workflowId} />;
}
