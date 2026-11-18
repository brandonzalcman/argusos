import { type BlockRenderContext, coreBlockRegistry } from "@argus/blocks";
import { Button, ConnectionIndicator, PageContainer, PageHeader } from "@argus/ui";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useMemo } from "react";
import { webBoardRenderer } from "./board-renderer.js";
import "./boards.css";
import { useBoardsEnvironment } from "./environment.js";
import { useBoardSummary, usePublishedBoard } from "./queries.js";
import { Badge, ErrorState, formatTimestamp, LoadingState, NoScopeState } from "./states.js";

/** Route-param helper: `boardId` is untrusted input and is only ever sent to the scoped API. */
export function useBoardIdParam(): string {
  const params = useParams({ strict: false });
  return typeof params.boardId === "string" ? params.boardId : "";
}

/**
 * Published board runtime.
 * Input: `boardId` route param; scope and ports come from BoardsEnvironment.
 * Output: the published layout rendered through the @argus/blocks registry on a 12-column grid.
 * Errors: loading, API failure and missing-scope states; per-block failures are contained per block.
 * Depends on: BoardsRepositoryPort.getPublished, BoardDataPort (live data), TODO(implementation) CEL.
 */
export function BoardRuntimePage(): ReactElement {
  const boardId = useBoardIdParam();
  const { scope, data } = useBoardsEnvironment();
  const query = usePublishedBoard(boardId);
  const summary = useBoardSummary(boardId);
  const bundle = query.data;

  const context = useMemo<BlockRenderContext | null>(
    () =>
      scope && bundle
        ? {
            scope,
            boardId,
            definitionVersion: bundle.definition.version,
            mode: "runtime",
          }
        : null,
    [scope, bundle, boardId],
  );

  if (!scope) {
    return (
      <PageContainer width="full">
        <PageHeader title="Board" />
        <NoScopeState />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="full">
      <PageHeader
        title={bundle ? bundle.definition.name : "Board"}
        breadcrumbs={[
          { label: "Boards", link: <Link to="/boards">Boards</Link> },
          { label: bundle ? bundle.definition.name : "Board" },
        ]}
        meta={
          bundle ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Published v{bundle.definition.version}</Badge>
              <span className="text-fg-muted">
                {formatTimestamp(bundle.definition.publishedAt)}
              </span>
            </span>
          ) : null
        }
        actions={
          <>
            {summary?.permissions.edit ? (
              <Button asChild>
                <Link to="/boards/$boardId/builder" params={{ boardId }}>
                  Edit board
                </Link>
              </Button>
            ) : null}
            <ConnectionIndicator
              variant="pill"
              state={query.isError ? "offline" : "polling"}
              {...(query.dataUpdatedAt > 0
                ? { lastUpdatedAt: new Date(query.dataUpdatedAt).toISOString() }
                : {})}
              stateDetail="Electric live query pending; refreshing every 5 s"
            />
          </>
        }
      />

      {query.isError ? (
        <ErrorState
          title="Could not load this board"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || !bundle || !context ? (
        <LoadingState label="Loading board" />
      ) : (
        webBoardRenderer.render({
          definition: bundle.definition,
          layout: bundle.layout,
          registry: coreBlockRegistry,
          context,
          data,
        })
      )}
    </PageContainer>
  );
}
