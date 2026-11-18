import type { StudioDefinitionSummary, StudioGetOutput } from "@argus/schema";
import type {
  BoardBundle,
  BoardSummary,
  BoardsRepositoryPort,
  BoardVersionSummary,
} from "../../features/boards/model.js";
import type { StudioPort } from "../studio.js";
import { ApiClientError } from "./trpc-http.js";

const PAGE_LIMIT = 200;
const MAX_PAGES = 10;
const MAX_CONCURRENCY = 4;

function bundleOf(output: StudioGetOutput): BoardBundle {
  if (output.document.kind !== "board") {
    throw new ApiClientError({ code: "internal", message: "response did not match contract" });
  }
  // TODO(verify): the shared schema bundle and the @argus/blocks-derived web BoardBundle are
  // structurally compatible today (checked by the compiler on this assignment, no cast).
  const { definition, layout } = output.document.bundle;
  return { definition, layout };
}

async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toSummary(item: StudioDefinitionSummary, blockCount: number): BoardSummary {
  return {
    id: item.id,
    key: item.key,
    name: item.name,
    description: item.description,
    publishedVersion: item.publishedVersion,
    draftVersion: item.draftVersion,
    publishedAt: item.publishedAt,
    blockCount,
    permissions: {
      view: item.permissions.view,
      edit: item.permissions.edit,
      publish: item.permissions.publish,
    },
  };
}

/**
 * Adapts the generic studio API to the boards feature port.
 *
 * The `scope` argument of every method is ignored for authority: the server derives tenant,
 * incident and position from the session cookie, so a client-supplied scope can never widen access.
 */
export function createBoardsRepositoryFromStudio(studio: StudioPort): BoardsRepositoryPort {
  async function getRevision(
    boardId: string,
    revision: "draft" | "published" | number,
  ): Promise<StudioGetOutput | null> {
    return studio.get({ kind: "board", id: boardId, revision });
  }

  async function requireRevision(
    boardId: string,
    revision: "published" | number,
  ): Promise<BoardBundle> {
    const output = await getRevision(boardId, revision);
    if (output === null) {
      throw new ApiClientError({ code: "not-found", message: "Board not found" });
    }
    return bundleOf(output);
  }

  return {
    /**
     * TODO(implementation): N+1 — `blockCount` is read by fetching each board's document. Ask for
     * `blockCount` in the studio summary contract and drop the per-board `studio.get` calls.
     * Input: board scope (ignored). Output: board summaries. Errors: ApiClientError.
     * Depends on: StudioDefinitionSummary gaining a block count.
     */
    list: async () => {
      const items: StudioDefinitionSummary[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await studio.list({
          kind: "board",
          search: null,
          cursor,
          limit: PAGE_LIMIT,
        });
        items.push(...result.items);
        cursor = result.nextCursor;
        if (cursor === null) break;
      }
      return mapLimited(items, MAX_CONCURRENCY, async (item) => {
        const revision = item.publishedVersion !== null ? "published" : "draft";
        const output = item.permissions.view ? await getRevision(item.id, revision) : null;
        const blockCount =
          output?.document.kind === "board" ? output.document.bundle.definition.blocks.length : 0;
        return toSummary(item, blockCount);
      });
    },
    getPublished: (_scope, boardId) => requireRevision(boardId, "published"),
    getDraft: async (_scope, boardId) => {
      const output = await getRevision(boardId, "draft");
      return output === null ? null : bundleOf(output);
    },
    getVersion: (_scope, boardId, version) => requireRevision(boardId, version),
    listVersions: async (_scope, boardId): Promise<readonly BoardVersionSummary[]> => {
      const versions = await studio.listVersions({ kind: "board", id: boardId });
      return versions.map((v) => ({
        version: v.version,
        lifecycle: v.lifecycle,
        changeSummary: v.changeSummary,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        publishedAt: v.publishedAt,
        publishedBy: v.publishedBy,
      }));
    },
    saveDraft: async (request) => {
      const result = await studio.saveDraft({
        id: request.boardId,
        baseVersion: request.baseVersion,
        document: { kind: "board", bundle: request.bundle },
      });
      return { version: result.version };
    },
    publish: async (request) => {
      const result = await studio.publish({
        kind: "board",
        id: request.boardId,
        expectedVersion: request.expectedVersion,
        changeSummary: request.changeSummary,
        idempotencyKey: request.idempotencyKey,
      });
      return { version: result.version, auditEventId: result.auditEventId };
    },
    rollback: async (request) => {
      const result = await studio.rollback({
        kind: "board",
        id: request.boardId,
        expectedPublishedVersion: request.expectedPublishedVersion,
        restoreVersion: request.restoreVersion,
        changeSummary: request.changeSummary,
        idempotencyKey: request.idempotencyKey,
      });
      return { version: result.version, auditEventId: result.auditEventId };
    },
  };
}
