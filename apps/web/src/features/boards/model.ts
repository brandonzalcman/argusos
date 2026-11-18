import type {
  BlockKind,
  BlockSecurityScope,
  BoardRendererProps,
  LayoutBreakpoint,
  LayoutDefinition,
  LayoutItem,
} from "@argus/blocks";

export type { BlockKind, LayoutBreakpoint, LayoutDefinition, LayoutItem };

/** Shared published board document, derived from the @argus/blocks renderer contract. */
export type BoardDefinition = BoardRendererProps["definition"];
export type BlockDefinition = BoardDefinition["blocks"][number];
export type BlockConfig = BlockDefinition["config"];
export type BoardScope = BlockSecurityScope;

/** A board definition and the reusable layout it references; edited and published together. */
export interface BoardBundle {
  readonly definition: BoardDefinition;
  readonly layout: LayoutDefinition;
}

export interface BoardSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly publishedVersion: number | null;
  readonly draftVersion: number | null;
  readonly publishedAt: string | null;
  readonly blockCount: number;
  /** Server-authoritative; the UI hides actions the caller cannot perform. */
  readonly permissions: {
    readonly view: boolean;
    readonly edit: boolean;
    readonly publish: boolean;
  };
}

export interface BoardVersionSummary {
  readonly version: number;
  readonly lifecycle: "draft" | "published" | "archived";
  readonly changeSummary: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly publishedAt: string | null;
  readonly publishedBy: string | null;
}

export interface SaveDraftRequest {
  readonly scope: BoardScope;
  readonly boardId: string;
  /** Optimistic base: the draft version this edit started from. */
  readonly baseVersion: number;
  readonly bundle: BoardBundle;
}

export interface PublishBoardRequest {
  readonly scope: BoardScope;
  readonly boardId: string;
  readonly expectedVersion: number;
  readonly changeSummary: string;
  readonly idempotencyKey: string;
}

export interface RollbackBoardRequest {
  readonly scope: BoardScope;
  readonly boardId: string;
  /** Published version currently live; the API rejects the rollback if it moved. */
  readonly expectedPublishedVersion: number;
  readonly restoreVersion: number;
  readonly changeSummary: string;
  readonly idempotencyKey: string;
}

export interface BoardMutationOutcome {
  readonly version: number;
  readonly auditEventId: string;
}

/**
 * Authorized board definition API seam.
 * Every method is tenant/incident scoped; the server enforces RBAC/ABAC and optimistic versions.
 */
export interface BoardsRepositoryPort {
  readonly list: (scope: BoardScope) => Promise<readonly BoardSummary[]>;
  readonly getPublished: (scope: BoardScope, boardId: string) => Promise<BoardBundle>;
  readonly getDraft: (scope: BoardScope, boardId: string) => Promise<BoardBundle | null>;
  readonly listVersions: (
    scope: BoardScope,
    boardId: string,
  ) => Promise<readonly BoardVersionSummary[]>;
  readonly getVersion: (
    scope: BoardScope,
    boardId: string,
    version: number,
  ) => Promise<BoardBundle>;
  readonly saveDraft: (request: SaveDraftRequest) => Promise<{ readonly version: number }>;
  readonly publish: (request: PublishBoardRequest) => Promise<BoardMutationOutcome>;
  readonly rollback: (request: RollbackBoardRequest) => Promise<BoardMutationOutcome>;
}

function repositoryNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): BoardsRepositoryPort.${method}`);
}

/**
 * TODO(implementation): connect board definition reads, drafts, publish and rollback to apps/api.
 * Input: tenant/incident scoped requests with optimistic versions and idempotency keys.
 * Output: a port whose methods throw; no board, draft or version is fabricated.
 * Errors: every method throws TODO(implementation); the UI renders an explicit error state.
 * Depends on: apps/api board endpoints, RBAC/ABAC + RLS, audit events, Electric live queries.
 */
export function createBoardsRepositoryStub(): BoardsRepositoryPort {
  return {
    list: () => repositoryNotImplemented("list"),
    getPublished: () => repositoryNotImplemented("getPublished"),
    getDraft: () => repositoryNotImplemented("getDraft"),
    listVersions: () => repositoryNotImplemented("listVersions"),
    getVersion: () => repositoryNotImplemented("getVersion"),
    saveDraft: () => repositoryNotImplemented("saveDraft"),
    publish: () => repositoryNotImplemented("publish"),
    rollback: () => repositoryNotImplemented("rollback"),
  };
}
