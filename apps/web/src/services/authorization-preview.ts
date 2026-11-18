import type { ActorContext, AppScope } from "./contracts.js";

export interface AuthorizationPreviewRequest {
  readonly scope: AppScope;
  readonly actor: ActorContext;
  readonly previewPositionId: string;
  readonly definitionVersion: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface BoardAuthorizationPreview extends AuthorizationPreviewRequest {
  readonly boardId: string;
}

export interface AuthorizationDecision {
  readonly effect: "allow" | "deny";
  readonly policyId: string;
  readonly reason: string;
}

export interface AuthorizationPreviewResult {
  readonly decisions: readonly AuthorizationDecision[];
  readonly hiddenBlockIds: readonly string[];
  readonly hiddenFieldIds: readonly string[];
  readonly readOnlyFieldIds: readonly string[];
  readonly evaluatedDefinitionVersion: number;
}

export interface AuthorizationPreviewPort {
  readonly previewBoard: (
    request: BoardAuthorizationPreview,
  ) => Promise<AuthorizationPreviewResult>;
  readonly previewRecordAction: (
    request: AuthorizationPreviewRequest & {
      readonly tableId: string;
      readonly recordId: string;
      readonly action: "read" | "update" | "delete";
      readonly baseVersion: number;
    },
  ) => Promise<AuthorizationPreviewResult>;
}

function authorizationNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): AuthorizationPreviewPort.${method}`);
}

/**
 * TODO(implementation): evaluate server-authoritative RBAC/ABAC previews for positions and fields.
 * Input: actor, preview position, scoped attributes, definition/record versions, and action.
 * Output: a throwing port; future results explain policy decisions and hidden/read-only elements.
 * Errors: both methods throw TODO(implementation); preview never grants production permissions.
 * Depends on: apps/api policy evaluation, @argus/expr CEL, RLS, and immutable audit policy versions.
 * Preview responses are tenant-bound and must not reveal the existence of hidden records or fields.
 */
export function createAuthorizationPreviewStub(): AuthorizationPreviewPort {
  return {
    previewBoard: () => authorizationNotImplemented("previewBoard"),
    previewRecordAction: () => authorizationNotImplemented("previewRecordAction"),
  };
}
