import type {
  OperationContext,
  StudioDefinitionKind,
  StudioItemPermissions,
  ViewAccessPolicy,
} from "@argus/schema";
import { and, eq } from "drizzle-orm";
import type { Transaction } from "../db/transaction.js";
import { apiError } from "../errors.js";
import { positions } from "../persistence/system-schema.js";

/** Studio permissions of the caller's acting position (columns of `meta.positions`). */
export interface StudioCallerPermissions {
  readonly viewStudio: boolean;
  readonly editDefinitions: boolean;
  readonly publishDefinitions: boolean;
  readonly editCode: boolean;
}

export async function loadCallerPermissions(
  tx: Transaction,
  context: OperationContext,
): Promise<StudioCallerPermissions> {
  const [row] = await tx
    .select({
      viewStudio: positions.studioView,
      editDefinitions: positions.studioEdit,
      publishDefinitions: positions.studioPublish,
      editCode: positions.studioEditCode,
    })
    .from(positions)
    .where(and(eq(positions.id, context.positionId), eq(positions.tenantId, context.tenantId)))
    .limit(1);
  if (row === undefined) {
    throw apiError("forbidden", "The acting position is not available in this tenant.");
  }
  return row;
}

/** Callers with any studio permission see every definition of their tenant (incl. drafts). */
export function isStudioCaller(permissions: StudioCallerPermissions): boolean {
  return (
    permissions.viewStudio ||
    permissions.editDefinitions ||
    permissions.publishDefinitions ||
    permissions.editCode
  );
}

/** Components additionally require `editCode` for every write (Decision 7). */
export function itemPermissions(
  permissions: StudioCallerPermissions,
  kind: StudioDefinitionKind,
): StudioItemPermissions {
  const code = kind !== "component" || permissions.editCode;
  return {
    view: permissions.viewStudio,
    edit: permissions.editDefinitions && code,
    publish: permissions.publishDefinitions && code,
    editCode: permissions.editCode,
  };
}

/**
 * View-access restriction of a published definition. `TODO(decision)`: an empty `positionIds` means
 * no extra restriction. `visibilityRule` (CEL) cannot be evaluated until @argus/expr lands, so a
 * definition with a rule is hidden rather than silently shown.
 */
export function accessAllows(access: ViewAccessPolicy | null, positionId: string): boolean {
  if (access === null) return true;
  if (access.visibilityRule !== null) return false;
  return access.positionIds.length === 0 || access.positionIds.includes(positionId);
}
