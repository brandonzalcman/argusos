import type { BlockRenderContext, BoardDataPort, BoardDataResult } from "@argus/blocks";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { BoardDefinition } from "../model.js";
import { isNotImplementedError, POLLING_INTERVAL_MS } from "../queries.js";

/** A data port that never settles must become an error state, not an endless skeleton. */
export const BLOCK_DATA_TIMEOUT_MS = 15_000;

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Data request timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Deterministic configuration error: retrying cannot help, so it surfaces immediately. */
export class BlockSourceError extends Error {}

export type BoardRow = BoardDataResult["rows"][number];

export interface UseBlockRowsInput {
  readonly definition: BoardDefinition;
  readonly context: BlockRenderContext;
  readonly data: BoardDataPort;
  readonly tableId: string | undefined;
  readonly viewId: string | undefined;
  readonly live: boolean;
}

/**
 * Block data hook over the scoped BoardDataPort.
 *
 * TODO(implementation): back this with an Electric live query so changes arrive by push. Until then
 * runtime boards poll every five seconds (the documented fallback) and the query key carries the
 * entire security scope so cached rows can never be reused across tenant/incident/position.
 * Input: the board definition (source lookup), render context, data port and table/view ids.
 * Output: a TanStack Query result with authorized rows and the server source version.
 * Errors: a table that is not a data source of the board rejects without calling the port; a port that
 * does not settle within BLOCK_DATA_TIMEOUT_MS rejects.
 */
export function useBlockRows(input: UseBlockRowsInput): UseQueryResult<BoardDataResult> {
  const { definition, context, data, tableId, viewId, live } = input;
  const source = tableId ? definition.dataSources.find((s) => s.tableId === tableId) : undefined;
  const { scope } = context;
  return useQuery({
    queryKey: [
      "boards",
      "block-data",
      scope.tenantId,
      scope.incidentId,
      scope.positionId,
      context.previewPositionId ?? null,
      context.boardId,
      context.definitionVersion,
      tableId ?? null,
      viewId ?? null,
    ],
    // A table that is not a data source must surface as an error, never as an endless skeleton.
    enabled: tableId !== undefined,
    retry: (count, error) =>
      !isNotImplementedError(error) && !(error instanceof BlockSourceError) && count < 2,
    refetchInterval: live ? POLLING_INTERVAL_MS : false,
    queryFn: async () => {
      if (!tableId || !source)
        throw new BlockSourceError("Table is not a data source of this board");
      return withTimeout(
        data.query({
          context,
          sourceId: source.alias,
          tableId,
          ...(viewId ? { viewId } : {}),
        }),
        BLOCK_DATA_TIMEOUT_MS,
      );
    },
  });
}
