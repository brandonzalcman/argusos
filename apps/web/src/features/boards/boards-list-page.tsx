import {
  Button,
  Card,
  ConnectionIndicator,
  Field,
  Input,
  PageContainer,
  PageHeader,
  Panel,
} from "@argus/ui";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import "./boards.css";
import { useBoardsEnvironment } from "./environment.js";
import type { BoardSummary } from "./model.js";
import { useBoardList } from "./queries.js";
import {
  Badge,
  EmptyState,
  ErrorState,
  formatTimestamp,
  LoadingState,
  NoScopeState,
} from "./states.js";

export function filterBoards(
  boards: readonly BoardSummary[],
  query: string,
): readonly BoardSummary[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return boards;
  return boards.filter((board) =>
    [board.name, board.key, board.description ?? ""].some((text) =>
      text.toLowerCase().includes(needle),
    ),
  );
}

function BoardCard({ board }: { readonly board: BoardSummary }): ReactElement {
  const hasDraft =
    board.draftVersion !== null &&
    (board.publishedVersion === null || board.draftVersion > board.publishedVersion);
  return (
    <li>
      <Card className="grid h-full content-start gap-2 p-(--argus-panel-p)">
        <h2 className="text-md font-semibold text-fg">{board.name}</h2>
        {board.description ? <p className="text-fg-muted">{board.description}</p> : null}
        <p className="flex flex-wrap items-center gap-2">
          {board.publishedVersion === null ? (
            <Badge tone="warning">Unpublished</Badge>
          ) : (
            <Badge tone="success">Published v{board.publishedVersion}</Badge>
          )}
          {hasDraft ? <Badge tone="warning">Draft v{board.draftVersion} pending</Badge> : null}
          <span className="text-fg-muted">{board.blockCount} blocks</span>
        </p>
        <p className="text-fg-muted">Published {formatTimestamp(board.publishedAt)}</p>
        <div className="flex flex-wrap gap-2">
          {board.permissions.view && board.publishedVersion !== null ? (
            <Button asChild variant="primary" size="sm">
              <Link
                to="/boards/$boardId"
                params={{ boardId: board.id }}
                aria-label={`Open ${board.name}`}
              >
                Open
              </Link>
            </Button>
          ) : null}
          {board.permissions.edit ? (
            <Button asChild size="sm">
              <Link
                to="/boards/$boardId/builder"
                params={{ boardId: board.id }}
                aria-label={`Edit ${board.name}`}
              >
                Edit
              </Link>
            </Button>
          ) : null}
          {board.permissions.edit && hasDraft ? (
            <Button asChild size="sm">
              <Link
                to="/boards/$boardId/diff"
                params={{ boardId: board.id }}
                aria-label={`Review changes to ${board.name}`}
              >
                Review changes
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

/**
 * Boards catalog: authorized boards from the scoped repository, refreshed live.
 * Input: none (scope and repository come from BoardsEnvironment).
 * Output: searchable list with loading, error, empty and no-match states.
 * Errors: repository failures render an error state with retry; nothing is fabricated.
 * Depends on: BoardsRepositoryPort.list; TODO(implementation) Electric live query replaces polling.
 */
export function BoardsListPage(): ReactElement {
  const { scope } = useBoardsEnvironment();
  const query = useBoardList();
  const [search, setSearch] = useState("");
  const visible = query.data ? filterBoards(query.data, search) : [];

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Boards"
        description="Boards your position is authorized to open or edit."
        actions={
          scope ? (
            <ConnectionIndicator
              variant="pill"
              state={query.isError ? "offline" : "polling"}
              {...(query.dataUpdatedAt > 0
                ? { lastUpdatedAt: new Date(query.dataUpdatedAt).toISOString() }
                : {})}
              stateDetail="Electric live query pending; refreshing every 5 s"
            />
          ) : null
        }
      />

      {!scope ? (
        <NoScopeState />
      ) : query.isError ? (
        <ErrorState
          title="Could not load boards"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <LoadingState label="Loading boards" />
      ) : query.data.length === 0 ? (
        <Panel title="No boards available">
          <EmptyState title="No boards available">
            No boards are visible to your position in this incident. Ask an administrator for
            access.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="max-w-md">
            <Field label="Search boards">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
          </div>
          <p role="status" aria-live="polite" className="text-fg-muted">
            {visible.length} of {query.data.length} boards
          </p>
          {visible.length === 0 ? (
            <EmptyState title="No matching boards">Try a different search.</EmptyState>
          ) : (
            <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-(--argus-gap) p-0">
              {visible.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </ul>
          )}
        </>
      )}
    </PageContainer>
  );
}
