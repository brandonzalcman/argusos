import type { BlockRenderContext, BoardDataPort, BoardDataResult } from "@argus/blocks";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { BoardDefinition } from "../model.js";
import { isNotImplementedError, POLLING_INTERVAL_MS } from "../queries.js";

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
 * Errors: a table that is not a data source of the board rejects without calling the port.
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
    enabled: tableId !== undefined && source !== undefined,
    retry: (count, error) => !isNotImplementedError(error) && count < 2,
    refetchInterval: live ? POLLING_INTERVAL_MS : false,
    queryFn: async () => {
      if (!tableId || !source) throw new Error("Table is not a data source of this board");
      return data.query({
        context,
        sourceId: source.alias,
        tableId,
        ...(viewId ? { viewId } : {}),
      });
    },
  });
}
