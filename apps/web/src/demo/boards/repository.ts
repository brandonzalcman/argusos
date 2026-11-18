import type {
  BoardBundle,
  BoardMutationOutcome,
  BoardScope,
  BoardSummary,
  BoardsRepositoryPort,
  BoardVersionSummary,
} from "../../features/boards/model.js";
import { DEMO_TENANT_ID, demoDelay, demoId } from "../scenario.js";
import { createInitialVersions } from "./definitions.js";

function assertScope(scope: BoardScope): void {
  if (scope.tenantId !== DEMO_TENANT_ID) throw new Error("Forbidden: tenant mismatch");
}

/** Re-stamps definition + layout metadata so both always agree. */
function restamp(
  bundle: BoardBundle,
  patch: Partial<BoardBundle["definition"]> & { readonly version: number },
): BoardBundle {
  const { version, lifecycle, changeSummary, publishedAt, publishedBy } = {
    ...bundle.definition,
    ...patch,
  };
  return {
    definition: { ...bundle.definition, ...patch },
    layout: { ...bundle.layout, version, lifecycle, changeSummary, publishedAt, publishedBy },
  };
}

/**
 * In-memory BoardsRepositoryPort. Honors the port's optimistic-version rules:
 * - saveDraft: base must equal the current draft version, or the published version when no draft
 *   exists (the new draft is then published + 1).
 * - publish: expectedVersion must equal the draft version; the old published version is archived.
 * - rollback: expectedPublishedVersion must equal the live version; restores a copy as a new
 *   published version (any draft is renumbered above it, not discarded).
 * Idempotency keys replay the original outcome.
 */
export function createDemoBoardsRepository(): BoardsRepositoryPort {
  const boards = new Map<string, BoardBundle[]>(
    [...createInitialVersions()].map(([id, versions]) => [id, [...versions]]),
  );
  const outcomes = new Map<string, BoardMutationOutcome>();

  const versionsOf = (boardId: string): BoardBundle[] => {
    const versions = boards.get(boardId);
    if (!versions) throw new Error(`Board ${boardId} not found`);
    return versions;
  };
  const find = (boardId: string, lifecycle: "published" | "draft"): BoardBundle | undefined =>
    versionsOf(boardId).find((b) => b.definition.lifecycle === lifecycle);
  const published = (boardId: string): BoardBundle => {
    const bundle = find(boardId, "published");
    if (!bundle) throw new Error(`Board ${boardId} has no published version`);
    return bundle;
  };
  const replace = (boardId: string, previous: BoardBundle, next: BoardBundle): void => {
    const versions = versionsOf(boardId);
    const index = versions.indexOf(previous);
    if (index >= 0) versions[index] = next;
    else versions.push(next);
  };
  const highestVersion = (boardId: string): number =>
    Math.max(...versionsOf(boardId).map((b) => b.definition.version));

  return {
    list: async (scope) => {
      assertScope(scope);
      const summaries: BoardSummary[] = [...boards.keys()].map((boardId) => {
        const live = published(boardId);
        const draft = find(boardId, "draft");
        const { definition } = live;
        return {
          id: definition.id,
          key: definition.key,
          name: definition.name,
          description: definition.description,
          publishedVersion: definition.version,
          draftVersion: draft?.definition.version ?? null,
          publishedAt: definition.publishedAt,
          blockCount: definition.blocks.length,
          permissions: { view: true, edit: true, publish: true },
        };
      });
      return demoDelay(summaries);
    },
    getPublished: async (scope, boardId) => {
      assertScope(scope);
      return demoDelay(published(boardId));
    },
    getDraft: async (scope, boardId) => {
      assertScope(scope);
      return demoDelay(find(boardId, "draft") ?? null);
    },
    listVersions: async (scope, boardId) => {
      assertScope(scope);
      const summaries: BoardVersionSummary[] = versionsOf(boardId)
        .map(({ definition }) => ({
          version: definition.version,
          lifecycle: definition.lifecycle,
          changeSummary: definition.changeSummary,
          createdAt: definition.createdAt,
          createdBy: definition.createdBy,
          publishedAt: definition.publishedAt,
          publishedBy: definition.publishedBy,
        }))
        .sort((a, b) => b.version - a.version);
      return demoDelay(summaries);
    },
    getVersion: async (scope, boardId, version) => {
      assertScope(scope);
      const found = versionsOf(boardId).find((b) => b.definition.version === version);
      if (!found) throw new Error(`Board ${boardId} has no version ${version}`);
      return demoDelay(found);
    },
    saveDraft: async (request) => {
      assertScope(request.scope);
      const { boardId, baseVersion, bundle, scope } = request;
      const draft = find(boardId, "draft");
      const live = published(boardId);
      const currentBase = draft ? draft.definition.version : live.definition.version;
      if (baseVersion !== currentBase) {
        throw new Error(
          `Conflict: the draft is at version ${currentBase} but this edit started from ${baseVersion}. Reload to continue.`,
        );
      }
      const version = draft ? currentBase : highestVersion(boardId) + 1;
      const next = restamp(bundle, {
        id: boardId,
        tenantId: DEMO_TENANT_ID,
        version,
        lifecycle: "draft",
        changeSummary: null,
        createdAt: new Date().toISOString(),
        createdBy: scope.userId,
        createdPositionId: scope.positionId,
        publishedAt: null,
        publishedBy: null,
      });
      replace(boardId, draft ?? next, next);
      return demoDelay({ version });
    },
    publish: async (request) => {
      assertScope(request.scope);
      const replay = outcomes.get(request.idempotencyKey);
      if (replay) return demoDelay(replay);
      const { boardId, expectedVersion, changeSummary, scope } = request;
      if (changeSummary.trim() === "") throw new Error("A change summary is required to publish.");
      const draft = find(boardId, "draft");
      if (!draft) throw new Error("There is no draft to publish.");
      if (draft.definition.version !== expectedVersion) {
        throw new Error(
          `Conflict: the draft is at version ${draft.definition.version}, expected ${expectedVersion}.`,
        );
      }
      const live = published(boardId);
      replace(
        boardId,
        live,
        restamp(live, { version: live.definition.version, lifecycle: "archived" }),
      );
      replace(
        boardId,
        draft,
        restamp(draft, {
          version: draft.definition.version,
          lifecycle: "published",
          changeSummary,
          publishedAt: new Date().toISOString(),
          publishedBy: scope.userId,
        }),
      );
      const outcome = { version: draft.definition.version, auditEventId: demoId() };
      outcomes.set(request.idempotencyKey, outcome);
      return demoDelay(outcome);
    },
    rollback: async (request) => {
      assertScope(request.scope);
      const replay = outcomes.get(request.idempotencyKey);
      if (replay) return demoDelay(replay);
      const { boardId, expectedPublishedVersion, restoreVersion, changeSummary, scope } = request;
      if (changeSummary.trim() === "") throw new Error("A change summary is required to restore.");
      const live = published(boardId);
      if (live.definition.version !== expectedPublishedVersion) {
        throw new Error(
          `Conflict: version ${live.definition.version} is live, expected ${expectedPublishedVersion}.`,
        );
      }
      const source = versionsOf(boardId).find((b) => b.definition.version === restoreVersion);
      if (!source || source.definition.lifecycle === "draft") {
        throw new Error(`Version ${restoreVersion} cannot be restored.`);
      }
      const version = highestVersion(boardId) + 1;
      const draft = find(boardId, "draft");
      replace(
        boardId,
        live,
        restamp(live, { version: live.definition.version, lifecycle: "archived" }),
      );
      if (draft) {
        replace(boardId, draft, restamp(draft, { version: version + 1 }));
      }
      versionsOf(boardId).push(
        restamp(source, {
          version,
          lifecycle: "published",
          changeSummary,
          createdAt: new Date().toISOString(),
          createdBy: scope.userId,
          createdPositionId: scope.positionId,
          publishedAt: new Date().toISOString(),
          publishedBy: scope.userId,
        }),
      );
      const outcome = { version, auditEventId: demoId() };
      outcomes.set(request.idempotencyKey, outcome);
      return demoDelay(outcome);
    },
  };
}
