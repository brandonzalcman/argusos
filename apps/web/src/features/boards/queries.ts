import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useBoardsEnvironment } from "./environment.js";
import type { BoardBundle, BoardScope, BoardSummary, BoardVersionSummary } from "./model.js";

/** Fallback poll interval while the Electric live-query adapter is not connected (plan §4A: 5 s). */
export const POLLING_INTERVAL_MS = 5_000;

export function isNotImplementedError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("TODO(implementation)");
}

function retryPolicy(failureCount: number, error: Error): boolean {
  return !isNotImplementedError(error) && failureCount < 2;
}

/** Keys always include the full scope so cached definitions can never cross tenant/incident/position. */
export function scopeKey(scope: BoardScope | null): readonly unknown[] {
  return scope ? [scope.tenantId, scope.incidentId, scope.positionId] : ["no-scope"];
}

/**
 * TODO(implementation): replace polling with an Electric live query for board definitions.
 * Input: the scoped environment. Output: TanStack Query results refreshed every five seconds.
 * Errors: port failures surface as query errors; nothing is fabricated.
 * Depends on: ElectricSyncPort subscriptions for the board definition tables.
 */
export function useBoardList(): UseQueryResult<readonly BoardSummary[]> {
  const { scope, repository } = useBoardsEnvironment();
  return useQuery({
    queryKey: ["boards", "list", ...scopeKey(scope)],
    enabled: scope !== null,
    retry: retryPolicy,
    refetchInterval: POLLING_INTERVAL_MS,
    queryFn: async () => {
      if (!scope) throw new Error("No scope");
      return repository.list(scope);
    },
  });
}

export function usePublishedBoard(boardId: string): UseQueryResult<BoardBundle> {
  const { scope, repository } = useBoardsEnvironment();
  return useQuery({
    queryKey: ["boards", "published", boardId, ...scopeKey(scope)],
    enabled: scope !== null,
    retry: retryPolicy,
    refetchInterval: POLLING_INTERVAL_MS,
    queryFn: async () => {
      if (!scope) throw new Error("No scope");
      return repository.getPublished(scope, boardId);
    },
  });
}

export function useDraftBoard(boardId: string): UseQueryResult<BoardBundle | null> {
  const { scope, repository } = useBoardsEnvironment();
  return useQuery({
    queryKey: ["boards", "draft", boardId, ...scopeKey(scope)],
    enabled: scope !== null,
    retry: retryPolicy,
    // Not polled: a refetch must never replace unsaved builder edits.
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!scope) throw new Error("No scope");
      return repository.getDraft(scope, boardId);
    },
  });
}

export function useBoardVersions(boardId: string): UseQueryResult<readonly BoardVersionSummary[]> {
  const { scope, repository } = useBoardsEnvironment();
  return useQuery({
    queryKey: ["boards", "versions", boardId, ...scopeKey(scope)],
    enabled: scope !== null,
    retry: retryPolicy,
    queryFn: async () => {
      if (!scope) throw new Error("No scope");
      return repository.listVersions(scope, boardId);
    },
  });
}

export function useBoardVersion(
  boardId: string,
  version: number | null,
): UseQueryResult<BoardBundle> {
  const { scope, repository } = useBoardsEnvironment();
  return useQuery({
    queryKey: ["boards", "version", boardId, version, ...scopeKey(scope)],
    enabled: scope !== null && version !== null,
    retry: retryPolicy,
    // Published versions are immutable, so they can be cached for the session.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      if (!scope || version === null) throw new Error("No scope");
      return repository.getVersion(scope, boardId, version);
    },
  });
}

export function useBoardSummary(boardId: string): BoardSummary | undefined {
  return useBoardList().data?.find((board) => board.id === boardId);
}
