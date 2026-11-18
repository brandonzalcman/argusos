import type { Position } from "@argus/schema";
import { useQueries, useQuery } from "@tanstack/react-query";
import { type ReactElement, useId } from "react";
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

/**
 * Server-authoritative preview of one board as a position (never grants production permissions).
 * Disabled until a position is chosen. Errors (including the current TODO stub) are returned, not hidden.
 */
export function useBoardPreview(positionId: string | null, target: BoardPreviewTarget | null) {
  const preview = usePreviewFn();
  const session = useFeatureSession();
  return useQuery({
    queryKey: [
      "authz-preview",
      session?.scope.tenantId,
      session?.scope.incidentId,
      positionId,
      target?.boardId,
      target?.definitionVersion,
    ],
    enabled: session !== null && positionId !== null && target !== null,
    retry: false,
    queryFn: () => preview(positionId as string, target as BoardPreviewTarget),
  });
}

/** Previews several boards for one position; results are keyed by boardId. */
export function useBoardPreviews(
  positionId: string | null,
  targets: readonly BoardPreviewTarget[],
) {
  const preview = usePreviewFn();
  const session = useFeatureSession();
  return useQueries({
    queries: targets.map((target) => ({
      queryKey: [
        "authz-preview",
        session?.scope.tenantId,
        session?.scope.incidentId,
        positionId,
        target.boardId,
        target.definitionVersion,
      ],
      enabled: session !== null && positionId !== null,
      retry: false,
      queryFn: () => preview(positionId as string, target),
    })),
  });
}

/** Boards the server denied: any decision with effect "deny". */
export function isDenied(result: AuthorizationPreviewResult | undefined): boolean {
  return result?.decisions.some((decision) => decision.effect === "deny") ?? false;
}

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
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600 }}>
        {label}
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose a position…</option>
        {positions.map((position) => (
          <option key={position.id} value={position.id}>
            {position.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Explains the policy decisions and hidden elements the server returned. */
export function DecisionList({
  result,
}: {
  readonly result: AuthorizationPreviewResult;
}): ReactElement {
  return (
    <div className="argus-stack" style={{ gap: "0.5rem" }}>
      <p className="argus-muted">
        Evaluated definition version {result.evaluatedDefinitionVersion}. Preview only — it does not
        change anyone’s real access.
      </p>
      {result.decisions.length === 0 ? (
        <p>No policy decisions were returned.</p>
      ) : (
        <ul aria-label="Policy decisions">
          {result.decisions.map((decision) => (
            <li key={decision.policyId}>
              <span aria-hidden="true">{decision.effect === "allow" ? "✓" : "✕"} </span>
              <strong>{decision.effect}</strong> — {decision.reason}{" "}
              <span className="argus-muted" style={{ fontFamily: "var(--argus-font-mono)" }}>
                {decision.policyId}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        Hidden blocks: {result.hiddenBlockIds.length} · hidden fields:{" "}
        {result.hiddenFieldIds.length} · read-only fields: {result.readOnlyFieldIds.length}
      </p>
    </div>
  );
}
