import { Field, Select } from "@argus/ui";
import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useMemo, useState } from "react";
import { useAppServices } from "../../app/services-provider.js";
import type { AuthorizationPreviewResult } from "../../services/authorization-preview.js";
import { useAdminService } from "../admin/admin-service.js";
import { useBoardsEnvironment } from "./environment.js";
import { ErrorState, LoadingState } from "./states.js";

const SELF = "__self__";

export interface PositionPreview {
  readonly positions: readonly { readonly id: string; readonly name: string }[];
  readonly positionsStatus: "pending" | "error" | "ready";
  readonly positionsError: unknown;
  readonly selectedPositionId: string | null;
  readonly selectedLabel: string | null;
  readonly setSelectedPositionId: (id: string | null) => void;
  readonly result: AuthorizationPreviewResult | undefined;
  readonly resultStatus: "idle" | "pending" | "error" | "ready";
  readonly resultError: unknown;
  /** Blocks the previewed position cannot see; empty when not previewing. */
  readonly hiddenBlockIds: ReadonlySet<string>;
}

/**
 * "Preview as position": asks the server-authoritative authorization preview which blocks and
 * fields another position would see. Preview never grants permissions; failures (including the
 * current TODO stub) are surfaced, not hidden.
 */
export function usePositionPreview(boardId: string, definitionVersion: number): PositionPreview {
  const { scope } = useBoardsEnvironment();
  const admin = useAdminService();
  const { authorizationPreview } = useAppServices();
  const [selected, setSelected] = useState<string | null>(null);

  const appScope = scope ? { tenantId: scope.tenantId, incidentId: scope.incidentId } : null;
  const positions = useQuery({
    queryKey: ["boards", "preview-positions", scope?.tenantId, scope?.incidentId],
    enabled: appScope !== null,
    retry: false,
    queryFn: async () => {
      if (!appScope) throw new Error("No scope");
      return (await admin.listPositions(appScope)).map((p) => ({ id: p.id, name: p.name }));
    },
  });

  const preview = useQuery({
    queryKey: [
      "boards",
      "preview-result",
      scope?.tenantId,
      scope?.incidentId,
      boardId,
      definitionVersion,
      selected,
    ],
    enabled: scope !== null && selected !== null,
    retry: false,
    queryFn: async () => {
      if (!scope || !selected) throw new Error("No preview target");
      return authorizationPreview.previewBoard({
        scope: { tenantId: scope.tenantId, incidentId: scope.incidentId },
        actor: { userId: scope.userId, positionId: scope.positionId, sessionId: scope.requestId },
        previewPositionId: selected,
        definitionVersion,
        boardId,
        attributes: {},
      });
    },
  });

  const list = positions.data ?? [];
  const hiddenBlockIds = useMemo(
    () => new Set(selected && preview.data ? preview.data.hiddenBlockIds : []),
    [selected, preview.data],
  );
  return {
    positions: list,
    positionsStatus: positions.isError ? "error" : positions.isPending ? "pending" : "ready",
    positionsError: positions.error,
    selectedPositionId: selected,
    selectedLabel: list.find((p) => p.id === selected)?.name ?? null,
    setSelectedPositionId: setSelected,
    result: preview.data,
    resultStatus: selected === null ? "idle" : preview.isError ? "error" : preview.isPending ? "pending" : "ready",
    resultError: preview.error,
    hiddenBlockIds,
  };
}

export function PositionPreviewControl({ preview }: { readonly preview: PositionPreview }): ReactElement {
  const { scope } = useBoardsEnvironment();
  return (
    <div className="grid gap-2">
      <Field
        label="Preview as position"
        description="Shows what another position would see. Server-authoritative; grants nothing."
      >
        <Select
          value={preview.selectedPositionId ?? SELF}
          onValueChange={(value) => preview.setSelectedPositionId(value === SELF ? null : value)}
          options={[
            { value: SELF, label: "My position (no preview)" },
            ...preview.positions
              .filter((p) => p.id !== scope?.positionId)
              .map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </Field>
      {preview.positionsStatus === "pending" ? <LoadingState label="Loading positions" /> : null}
      {preview.positionsStatus === "error" ? (
        <ErrorState title="Positions unavailable" error={preview.positionsError} />
      ) : null}
      {preview.resultStatus === "pending" ? <LoadingState label="Evaluating preview" /> : null}
      {preview.resultStatus === "error" ? (
        <ErrorState title="Preview unavailable" error={preview.resultError} />
      ) : null}
      {preview.resultStatus === "ready" && preview.result ? (
        <div role="status" className="grid gap-1 text-sm">
          <p>
            As <strong>{preview.selectedLabel}</strong>: {preview.result.hiddenBlockIds.length} blocks
            hidden, {preview.result.hiddenFieldIds.length} fields hidden,{" "}
            {preview.result.readOnlyFieldIds.length} read-only.
          </p>
          <ul className="list-disc ps-5 text-fg-muted">
            {preview.result.decisions.map((d) => (
              <li key={d.policyId}>
                {d.effect === "allow" ? "Allow" : "Deny"}: {d.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
