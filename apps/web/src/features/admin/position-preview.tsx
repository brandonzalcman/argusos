import type { Position } from "@argus/schema";
import { Badge, Field, Select } from "@argus/ui";
import { CircleCheck, CircleX } from "@argus/ui/icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useAppServices } from "../../app/services-provider.js";
import type { AuthorizationPreviewResult } from "../../services/authorization-preview.js";
import { useFeatureSession } from "../workflows/feature-scope.js";

export interface BoardPreviewTarget {
  readonly boardId: string;
  readonly definitionVersion: number;
}

function usePreviewFn() {
  const { authorizationPreview } = useAppServices();
  const session = useFeatureSession();
  return (positionId: string, target: BoardPreviewTarget) => {
    if (!session) return Promise.reject(new Error("No session scope available"));
    return authorizationPreview.previewBoard({
      scope: session.scope,
      actor: session.actor,
      previewPositionId: positionId,
      definitionVersion: target.definitionVersion,
      boardId: target.boardId,
      attributes: {},
    });
  };
}

function previewKey(
  tenantId: string | undefined,
  incidentId: string | null | undefined,
  positionId: string | null,
  target: BoardPreviewTarget | null,
): readonly unknown[] {
  return [
    "authz-preview",
    tenantId,
    incidentId,
    positionId,
    target?.boardId,
    target?.definitionVersion,
  ];
}

/**
 * Server-authoritative preview of one board as a position (never grants production permissions).
 * Disabled until a position is chosen. Errors (including the current TODO stub) are returned, not hidden.
 */
export function useBoardPreview(positionId: string | null, target: BoardPreviewTarget | null) {
  const preview = usePreviewFn();
  const session = useFeatureSession();
  return useQuery({
    queryKey: previewKey(session?.scope.tenantId, session?.scope.incidentId, positionId, target),
    enabled: session !== null && positionId !== null && target !== null,
    retry: false,
    queryFn: () => preview(positionId as string, target as BoardPreviewTarget),
  });
}

/** Previews several boards for one position; results are in the same order as the targets. */
export function useBoardPreviews(
  positionId: string | null,
  targets: readonly BoardPreviewTarget[],
) {
  const preview = usePreviewFn();
  const session = useFeatureSession();
  return useQueries({
    queries: targets.map((target) => ({
      queryKey: previewKey(session?.scope.tenantId, session?.scope.incidentId, positionId, target),
      enabled: session !== null && positionId !== null,
      retry: false,
      queryFn: () => preview(positionId as string, target),
    })),
  });
}

/** True when the server returned any decision with effect "deny". */
export function isDenied(result: AuthorizationPreviewResult | undefined): boolean {
  return result?.decisions.some((decision) => decision.effect === "deny") ?? false;
}

const NO_POSITION = "__none__";

/** Position picker for previews. */
export function PositionSelect({
  positions,
  value,
  onChange,
  label = "Preview as position",
}: {
  readonly positions: readonly Position[];
  readonly value: string | null;
  readonly onChange: (positionId: string | null) => void;
  readonly label?: string;
}): ReactElement {
  return (
    <Field label={label} className="max-w-sm">
      <Select
        value={value ?? NO_POSITION}
        onValueChange={(next) => onChange(next === NO_POSITION ? null : next)}
        options={[
          { value: NO_POSITION, label: "Choose a position…" },
          ...positions.map((position) => ({ value: position.id, label: position.name })),
        ]}
      />
    </Field>
  );
}

/** Explains the policy decisions and hidden elements the server returned. */
export function DecisionList({
  result,
}: {
  readonly result: AuthorizationPreviewResult;
}): ReactElement {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-fg-muted">
        Evaluated definition version {result.evaluatedDefinitionVersion}. Preview only: it does not
        change anyone's real access.
      </p>
      {result.decisions.length === 0 ? (
        <p className="text-base">No policy decisions were returned.</p>
      ) : (
        <ul aria-label="Policy decisions" className="grid gap-1.5">
          {result.decisions.map((decision) => (
            <li key={decision.policyId} className="flex flex-wrap items-center gap-2 text-base">
              <Badge
                tone={decision.effect === "allow" ? "success" : "critical"}
                icon={decision.effect === "allow" ? <CircleCheck /> : <CircleX />}
              >
                {decision.effect}
              </Badge>
              <span>{decision.reason}</span>
              <code className="font-mono text-xs text-fg-muted">{decision.policyId}</code>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-fg-muted">
        Hidden blocks: {result.hiddenBlockIds.length} · hidden fields:{" "}
        {result.hiddenFieldIds.length} · read-only fields: {result.readOnlyFieldIds.length}
      </p>
    </div>
  );
}
