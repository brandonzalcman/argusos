import { randomUUID } from "node:crypto";
import {
  type DefinitionIssue,
  type OperationContext,
  type StudioApi,
  type StudioArchiveInput,
  type StudioCreateInput,
  type StudioDefinitionKind,
  type StudioDocument,
  type StudioGetInput,
  type StudioGetOutput,
  type StudioGetPageBySlugInput,
  type StudioListInput,
  type StudioMutationOutput,
  type StudioPublishInput,
  type StudioRollbackInput,
  type StudioSaveDraftInput,
  type StudioValidateInput,
  studioGetOutputSchema,
  studioListOutputSchema,
  studioMutationOutputSchema,
  studioValidateOutputSchema,
  studioVersionSummarySchema,
} from "@argus/schema";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "../db/client.js";
import { resultRows } from "../db/client.js";
import { type Transaction, withTenantTransaction } from "../db/transaction.js";
import { apiError } from "../errors.js";
import {
  definitionChanges,
  positions,
  studioDefinitions,
  studioDefinitionVersions,
} from "../persistence/system-schema.js";
import { claimIdempotency, completeIdempotency, requestHash } from "./idempotency.js";
import {
  accessOf,
  catalogFieldsOf,
  currentVersionOf,
  type DefinitionRow,
  decodeCursor,
  encodeCursor,
  escapeLike,
  metadataOf,
  parseStoredDocument,
  stampDocument,
  toSummary,
  translateUniqueViolation,
  type VersionMetadata,
  type VersionRow,
} from "./mapping.js";
import {
  accessAllows,
  isStudioCaller,
  itemPermissions,
  loadCallerPermissions,
  type StudioCallerPermissions,
} from "./permissions.js";
import { createStarterDocument, duplicateDocument } from "./templates.js";
import { type StudioReferenceLookup, validateStudioDocument } from "./validation.js";

export interface StudioServiceDependencies {
  readonly database: Database;
  readonly now?: () => Date;
}

/**
 * Server-derived context: the OperationContext plus (optionally) the request correlation id, which is
 * written to the audit trail. Without one the request id is used.
 */
export type StudioCallerContext = OperationContext & { readonly correlationId?: string };

/** `StudioApi` where every method also receives the server-derived context. */
export type StudioService = {
  readonly [K in keyof StudioApi]: (
    context: StudioCallerContext,
    input: Parameters<StudioApi[K]>[0],
  ) => ReturnType<StudioApi[K]>;
};

interface Caller {
  readonly context: StudioCallerContext;
  readonly permissions: StudioCallerPermissions;
  /** One clock reading per call (millisecond precision so keyset cursors round-trip exactly). */
  readonly at: Date;
}

type AuditOperation = "create-draft" | "update-draft" | "publish" | "restore" | "archive";

const def = studioDefinitions;
const ver = studioDefinitionVersions;

function conflict(currentVersion: number | null) {
  return apiError(
    "definition-version-conflict",
    "The definition was changed by someone else. Reload it and try again.",
    currentVersion === null ? {} : { details: { currentVersion } },
  );
}

function notFound() {
  return apiError("not-found", "The definition was not found.");
}

function forbidden(message: string) {
  return apiError("forbidden", message);
}

function issuesToFieldErrors(issues: readonly DefinitionIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    const list = out[key] ?? [];
    list.push(issue.message);
    out[key] = list;
  }
  return out;
}

/** Reference lookups over the caller's tenant transaction (explicit predicates + RLS). */
function createReferenceLookup(tx: Transaction, tenantId: string): StudioReferenceLookup {
  return {
    async publishedBoardExists(boardId) {
      const rows = await tx
        .select({ id: def.id })
        .from(def)
        .where(
          and(
            eq(def.id, boardId),
            eq(def.tenantId, tenantId),
            eq(def.kind, "board"),
            isNotNull(def.publishedVersion),
            isNull(def.archivedAt),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
    async publishedComponentVersionExists(componentId, version) {
      const rows = await tx
        .select({ version: ver.version })
        .from(ver)
        .innerJoin(def, and(eq(def.id, ver.definitionId), eq(def.tenantId, ver.tenantId)))
        .where(
          and(
            eq(ver.definitionId, componentId),
            eq(ver.tenantId, tenantId),
            eq(ver.version, version),
            eq(ver.lifecycle, "published"),
            eq(def.kind, "component"),
            isNull(def.archivedAt),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
    async existingPositions(positionIds) {
      if (positionIds.length === 0) return [];
      const rows = await tx
        .select({ id: positions.id })
        .from(positions)
        .where(and(eq(positions.tenantId, tenantId), inArray(positions.id, [...positionIds])));
      return rows.map((row) => row.id);
    },
    async positionsClaimedByOtherPage(positionIds, excludePageId) {
      if (positionIds.length === 0) return [];
      const list = sql.join(
        positionIds.map((id) => sql`${id}`),
        sql`, `,
      );
      const exclude = excludePageId === null ? sql`true` : sql`${def.id} <> ${excludePageId}::uuid`;
      const result = await tx.execute(sql`
        select distinct claimed.value as position_id
        from ${def}
        join ${ver} on ${ver.definitionId} = ${def.id} and ${ver.version} = ${def.publishedVersion}
        cross join lateral jsonb_array_elements_text(
          ${ver.document} #> '{definition,homepageForPositionIds}'
        ) as claimed(value)
        where ${def.tenantId} = ${tenantId}::uuid
          and ${def.kind} = 'page'
          and ${def.archivedAt} is null
          and ${exclude}
          and claimed.value in (${list})`);
      return resultRows<{ position_id: string }>(result).map((row) => row.position_id);
    },
  };
}

/**
 * Serialize page-homepage claims per tenant. Without it two concurrent publishes of different pages
 * could both pass the "position already claimed" check and both commit. Transaction-scoped: released
 * on commit/rollback. Bound parameter only; must be taken before the claim check.
 */
async function lockHomepageClaims(tx: Transaction, tenantId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`argus.page-homepage:${tenantId}`}::text, 0))`,
  );
}

type Dependent = {
  readonly id: string;
  readonly kind: StudioDefinitionKind;
  readonly name: string;
};

/**
 * Published, non-archived definitions of the tenant whose published document references `target`
 * (board-embed -> board id, custom-component -> component id).
 */
async function findPublishedDependents(
  tx: Transaction,
  tenantId: string,
  target: { readonly id: string; readonly kind: StudioDefinitionKind },
): Promise<Dependent[]> {
  if (target.kind === "page") return [];
  const blockType = target.kind === "board" ? "board-embed" : "custom-component";
  const configKey = target.kind === "board" ? "boardId" : "componentId";
  const result = await tx.execute(sql`
    select distinct ${def.id} as id, ${def.kind} as kind, ${def.name} as name
    from ${def}
    join ${ver} on ${ver.definitionId} = ${def.id} and ${ver.version} = ${def.publishedVersion}
    cross join lateral jsonb_array_elements(coalesce(
      ${ver.document} #> '{definition,blocks}',
      ${ver.document} #> '{bundle,definition,blocks}',
      '[]'::jsonb
    )) as b(block)
    where ${def.tenantId} = ${tenantId}::uuid
      and ${def.archivedAt} is null
      and ${def.id} <> ${target.id}::uuid
      and b.block ->> 'type' = ${blockType}::text
      and b.block -> 'config' ->> ${configKey}::text = ${target.id}::text
    order by name, id`);
  return resultRows<Dependent>(result);
}

async function loadCaller(
  tx: Transaction,
  context: StudioCallerContext,
  at: Date,
): Promise<Caller> {
  return { context, permissions: await loadCallerPermissions(tx, context), at };
}

async function findDefinition(
  tx: Transaction,
  tenantId: string,
  id: string,
  kind?: StudioDefinitionKind,
): Promise<DefinitionRow | null> {
  const [row] = await tx
    .select()
    .from(def)
    .where(
      and(
        eq(def.id, id),
        eq(def.tenantId, tenantId),
        kind === undefined ? undefined : eq(def.kind, kind),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function findVersion(
  tx: Transaction,
  tenantId: string,
  definitionId: string,
  version: number,
): Promise<VersionRow | null> {
  const [row] = await tx
    .select()
    .from(ver)
    .where(
      and(eq(ver.definitionId, definitionId), eq(ver.tenantId, tenantId), eq(ver.version, version)),
    )
    .limit(1);
  return row ?? null;
}

async function publishedAtOf(tx: Transaction, row: DefinitionRow): Promise<Date | null> {
  if (row.publishedVersion === null) return null;
  const published = await findVersion(tx, row.tenantId, row.id, row.publishedVersion);
  return published?.publishedAt ?? null;
}

/** Studio callers see everything in their tenant; others only published, non-archived, access-allowed items. */
async function isVisible(tx: Transaction, caller: Caller, row: DefinitionRow): Promise<boolean> {
  if (isStudioCaller(caller.permissions)) return true;
  if (row.archivedAt !== null || row.publishedVersion === null) return false;
  const published = await findVersion(tx, row.tenantId, row.id, row.publishedVersion);
  if (published === null) return false;
  return accessAllows(accessOf(parseStoredDocument(published.document)), caller.context.positionId);
}

async function requireVisible(
  tx: Transaction,
  caller: Caller,
  id: string,
  kind?: StudioDefinitionKind,
): Promise<DefinitionRow> {
  const row = await findDefinition(tx, caller.context.tenantId, id, kind);
  if (row === null || !(await isVisible(tx, caller, row))) throw notFound();
  return row;
}

function requireItemPermission(
  caller: Caller,
  kind: StudioDefinitionKind,
  permission: "view" | "edit" | "publish",
): void {
  if (!itemPermissions(caller.permissions, kind)[permission]) {
    throw forbidden(`Your position is not allowed to ${permission} this ${kind}.`);
  }
}

/** After a lost conditional update: re-read to report not-found, archived or a version conflict. */
async function explainFailedUpdate(tx: Transaction, caller: Caller, id: string): Promise<never> {
  const fresh = await findDefinition(tx, caller.context.tenantId, id);
  if (fresh === null) throw notFound();
  if (fresh.archivedAt !== null) {
    throw apiError("validation-failed", "The definition is archived.", {
      fieldErrors: { id: ["The definition is archived."] },
    });
  }
  throw conflict(currentVersionOf(fresh));
}

async function appendAudit(
  tx: Transaction,
  caller: Caller,
  entry: {
    readonly kind: StudioDefinitionKind;
    readonly definitionId: string;
    readonly operation: AuditOperation;
    readonly previousVersion: number | null;
    readonly version: number;
    readonly changeSummary: string | null;
  },
): Promise<string> {
  const [row] = await tx
    .insert(definitionChanges)
    .values({
      tenantId: caller.context.tenantId,
      definitionKind: entry.kind,
      definitionId: entry.definitionId,
      previousVersion: entry.previousVersion,
      version: entry.version,
      operation: entry.operation,
      changeSummary: entry.changeSummary,
      actorUserId: caller.context.userId,
      actorPositionId: caller.context.positionId,
      requestId: caller.context.requestId,
      correlationId: caller.context.correlationId ?? caller.context.requestId,
      occurredAt: caller.at,
    })
    .returning({ id: definitionChanges.id });
  if (row === undefined) throw apiError("internal", "The audit event could not be recorded.");
  return row.id;
}

/** Run `work`, translating catalog unique violations into validation errors. */
async function withUniqueTranslation<T>(
  kind: StudioDefinitionKind,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (caught) {
    throw translateUniqueViolation(caught, kind);
  }
}

function draftMetadata(caller: Caller, version: number): VersionMetadata {
  return {
    version,
    lifecycle: "draft",
    changeSummary: null,
    createdAt: caller.at,
    createdBy: caller.context.userId,
    createdPositionId: caller.context.positionId,
    publishedAt: null,
    publishedBy: null,
  };
}

function toGetOutput(
  row: DefinitionRow,
  versionRow: VersionRow,
  publishedAt: Date | null,
  caller: Caller,
): StudioGetOutput {
  const stamped = stampDocument(
    parseStoredDocument(versionRow.document),
    { definitionId: row.id, tenantId: row.tenantId, layoutId: null },
    metadataOf(versionRow),
  );
  return studioGetOutputSchema.parse({
    summary: toSummary(row, publishedAt, itemPermissions(caller.permissions, row.kind)),
    version: versionRow.version,
    document: stamped,
  });
}

/**
 * Studio service. Every method runs in one tenant transaction (RLS + explicit tenant predicates),
 * loads the caller's position permissions, and for mutations writes the audit row in the same
 * transaction.
 */
export function createStudioService(dependencies: StudioServiceDependencies): StudioService {
  const { database } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  function run<T>(
    context: StudioCallerContext,
    work: (tx: Transaction, caller: Caller) => Promise<T>,
  ): Promise<T> {
    const at = new Date(Math.floor(now().getTime()));
    return withTenantTransaction(
      database,
      {
        tenantId: context.tenantId,
        userId: context.userId,
        positionId: context.positionId,
        requestId: context.requestId,
      },
      async (tx) => work(tx, await loadCaller(tx, context, at)),
    );
  }

  /** Idempotent mutation wrapper: claim, run, store the response (all in the caller's transaction). */
  async function idempotent(
    tx: Transaction,
    caller: Caller,
    operation: string,
    input: { readonly idempotencyKey: string },
    work: () => Promise<StudioMutationOutput>,
  ): Promise<StudioMutationOutput> {
    const scope = { tenantId: caller.context.tenantId, userId: caller.context.userId };
    const claim = await claimIdempotency(tx, scope, {
      key: input.idempotencyKey,
      operation,
      hash: requestHash(input),
    });
    if (claim.replay) return studioMutationOutputSchema.parse(claim.response);
    const output = studioMutationOutputSchema.parse(await work());
    await completeIdempotency(tx, scope, input.idempotencyKey, output);
    return output;
  }

  return {
    async list(context, input: StudioListInput) {
      return run(context, async (tx, caller) => {
        const { tenantId, positionId } = caller.context;
        const conditions: (SQL | undefined)[] = [
          eq(def.tenantId, tenantId),
          eq(def.kind, input.kind),
          isNull(def.archivedAt),
        ];
        if (!isStudioCaller(caller.permissions)) {
          const access = sql`(case ${def.kind}
            when 'board' then ${ver.document} #> '{bundle,definition,access}'
            when 'page' then ${ver.document} #> '{definition,access}'
            else null end)`;
          conditions.push(
            isNotNull(def.publishedVersion),
            sql`(${access} is null or ((${access} ->> 'visibilityRule') is null and (
              jsonb_array_length(${access} -> 'positionIds') = 0
              or (${access} -> 'positionIds') @> to_jsonb(${positionId}::text))))`,
          );
        }
        if (input.search !== null && input.search.trim().length > 0) {
          const pattern = `%${escapeLike(input.search.trim())}%`;
          conditions.push(or(ilike(def.name, pattern), ilike(def.key, pattern)));
        }
        if (input.cursor !== null) {
          const cursor = decodeCursor(input.cursor);
          conditions.push(
            or(
              lt(def.updatedAt, cursor.updatedAt),
              and(eq(def.updatedAt, cursor.updatedAt), lt(def.id, cursor.id)),
            ),
          );
        }
        const rows = await tx
          .select({ row: def, publishedAt: ver.publishedAt })
          .from(def)
          .leftJoin(
            ver,
            and(
              eq(ver.definitionId, def.id),
              eq(ver.tenantId, def.tenantId),
              eq(ver.version, def.publishedVersion),
            ),
          )
          .where(and(...conditions))
          .orderBy(desc(def.updatedAt), desc(def.id))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const last = page.at(-1);
        const permissions = itemPermissions(caller.permissions, input.kind);
        return studioListOutputSchema.parse({
          items: page.map((entry) => toSummary(entry.row, entry.publishedAt, permissions)),
          nextCursor:
            rows.length > input.limit && last !== undefined
              ? encodeCursor(last.row.updatedAt, last.row.id)
              : null,
        });
      });
    },

    async get(context, input: StudioGetInput) {
      return run(context, async (tx, caller) => {
        const row = await requireVisible(tx, caller, input.id, input.kind);
        if (input.revision !== "published") requireItemPermission(caller, row.kind, "view");
        let version: number | null;
        if (input.revision === "draft") version = row.draftVersion;
        else if (input.revision === "published") version = row.publishedVersion;
        else version = input.revision;
        if (version === null) return null;
        const versionRow = await findVersion(tx, row.tenantId, row.id, version);
        if (versionRow === null) {
          if (typeof input.revision === "number") throw notFound();
          return null;
        }
        return toGetOutput(row, versionRow, await publishedAtOf(tx, row), caller);
      });
    },

    async getPageBySlug(context, input: StudioGetPageBySlugInput) {
      return run(context, async (tx, caller) => {
        const [row] = await tx
          .select()
          .from(def)
          .where(
            and(
              eq(def.tenantId, caller.context.tenantId),
              eq(def.kind, "page"),
              eq(def.slug, input.slug),
              isNull(def.archivedAt),
              isNotNull(def.publishedVersion),
            ),
          )
          .limit(1);
        if (row === undefined || row.publishedVersion === null) return null;
        const versionRow = await findVersion(tx, row.tenantId, row.id, row.publishedVersion);
        if (versionRow === null) return null;
        const output = toGetOutput(row, versionRow, versionRow.publishedAt, caller);
        // Runtime lookup: the page's access restriction applies to every caller, studio or not.
        if (!accessAllows(accessOf(output.document), caller.context.positionId)) return null;
        return output;
      });
    },

    async listVersions(context, input) {
      return run(context, async (tx, caller) => {
        const row = await requireVisible(tx, caller, input.id, input.kind);
        requireItemPermission(caller, row.kind, "view");
        const rows = await tx
          .select()
          .from(ver)
          .where(and(eq(ver.definitionId, row.id), eq(ver.tenantId, row.tenantId)))
          .orderBy(desc(ver.version));
        return rows.map((entry) =>
          studioVersionSummarySchema.parse({
            version: entry.version,
            lifecycle: entry.lifecycle,
            changeSummary: entry.changeSummary,
            createdAt: entry.createdAt.toISOString(),
            createdBy: entry.createdBy,
            publishedAt: entry.publishedAt === null ? null : entry.publishedAt.toISOString(),
            publishedBy: entry.publishedBy,
          }),
        );
      });
    },

    async create(context, input: StudioCreateInput) {
      return run(context, async (tx, caller) => {
        requireItemPermission(caller, input.kind, "edit");
        return idempotent(tx, caller, "studio.create", input, async () => {
          const { tenantId } = caller.context;
          let document: StudioDocument;
          if (input.template.type === "duplicate") {
            const source = await requireVisible(tx, caller, input.template.sourceId, input.kind);
            const published =
              source.publishedVersion === null || source.archivedAt !== null
                ? null
                : await findVersion(tx, tenantId, source.id, source.publishedVersion);
            if (published === null) throw notFound();
            document = duplicateDocument(parseStoredDocument(published.document), {
              key: input.key,
              name: input.name,
            });
          } else {
            document = createStarterDocument({
              kind: input.kind,
              key: input.key,
              name: input.name,
              template: input.template,
            });
          }
          const id = randomUUID();
          const stamped = stampDocument(
            document,
            {
              definitionId: id,
              tenantId,
              layoutId: document.kind === "board" ? randomUUID() : null,
            },
            draftMetadata(caller, 1),
          );
          const fields = catalogFieldsOf(stamped);
          await withUniqueTranslation(input.kind, async () => {
            await tx.insert(def).values({
              id,
              tenantId,
              kind: input.kind,
              key: fields.key,
              name: fields.name,
              description: fields.description,
              slug: fields.slug,
              draftVersion: 1,
              publishedVersion: null,
              latestVersion: 1,
              createdAt: caller.at,
              createdBy: caller.context.userId,
              updatedAt: caller.at,
              updatedBy: caller.context.userId,
            });
          });
          await tx.insert(ver).values({
            tenantId,
            definitionId: id,
            version: 1,
            lifecycle: "draft",
            document: stamped,
            changeSummary: null,
            createdAt: caller.at,
            createdBy: caller.context.userId,
            createdPositionId: caller.context.positionId,
          });
          const auditEventId = await appendAudit(tx, caller, {
            kind: input.kind,
            definitionId: id,
            operation: "create-draft",
            previousVersion: null,
            version: 1,
            changeSummary: null,
          });
          return { id, version: 1, auditEventId };
        });
      });
    },

    async saveDraft(context, input: StudioSaveDraftInput) {
      return run(context, async (tx, caller) => {
        const { tenantId, userId, positionId } = caller.context;
        const row = await requireVisible(tx, caller, input.id);
        requireItemPermission(caller, row.kind, "edit");
        if (input.document.kind !== row.kind) {
          throw apiError("validation-failed", "The document kind does not match the definition.", {
            fieldErrors: { "document.kind": [`Expected a ${row.kind} document.`] },
          });
        }
        const hadDraft = row.draftVersion !== null;
        const currentVersion = currentVersionOf(row);
        if (
          currentVersion === null ||
          row.archivedAt !== null ||
          input.baseVersion !== currentVersion
        ) {
          return explainFailedUpdate(tx, caller, row.id);
        }
        const baseRow = await findVersion(tx, tenantId, row.id, currentVersion);
        const baseDocument = baseRow === null ? null : parseStoredDocument(baseRow.document);
        const layoutId = baseDocument?.kind === "board" ? baseDocument.bundle.layout.id : null;

        const fields = catalogFieldsOf(input.document);
        const neverPublished = row.publishedVersion === null;
        const baseCondition = hadDraft
          ? eq(def.draftVersion, input.baseVersion)
          : and(isNull(def.draftVersion), eq(def.publishedVersion, input.baseVersion));
        const updated = await withUniqueTranslation(row.kind, () =>
          tx
            .update(def)
            .set({
              draftVersion: sql`${def.latestVersion} + 1`,
              latestVersion: sql`${def.latestVersion} + 1`,
              name: fields.name,
              description: fields.description,
              // Key and slug are live identifiers once published; they change on publish instead.
              ...(neverPublished ? { key: fields.key, slug: fields.slug } : {}),
              updatedAt: caller.at,
              updatedBy: userId,
              rowVersion: sql`${def.rowVersion} + 1`,
            })
            .where(
              and(
                eq(def.id, row.id),
                eq(def.tenantId, tenantId),
                isNull(def.archivedAt),
                baseCondition,
              ),
            )
            .returning({ version: def.latestVersion }),
        );
        const next = updated[0]?.version;
        if (next === undefined) return explainFailedUpdate(tx, caller, row.id);

        if (hadDraft) {
          await tx
            .delete(ver)
            .where(
              and(
                eq(ver.definitionId, row.id),
                eq(ver.tenantId, tenantId),
                eq(ver.version, input.baseVersion),
                eq(ver.lifecycle, "draft"),
              ),
            );
        }
        await tx.insert(ver).values({
          tenantId,
          definitionId: row.id,
          version: next,
          lifecycle: "draft",
          document: stampDocument(
            input.document,
            { definitionId: row.id, tenantId, layoutId },
            draftMetadata(caller, next),
          ),
          changeSummary: null,
          createdAt: caller.at,
          createdBy: userId,
          createdPositionId: positionId,
        });
        const auditEventId = await appendAudit(tx, caller, {
          kind: row.kind,
          definitionId: row.id,
          operation: hadDraft ? "update-draft" : "create-draft",
          previousVersion: input.baseVersion,
          version: next,
          changeSummary: null,
        });
        return studioMutationOutputSchema.parse({ id: row.id, version: next, auditEventId });
      });
    },

    async publish(context, input: StudioPublishInput) {
      return run(context, async (tx, caller) => {
        const { tenantId, userId } = caller.context;
        const row = await requireVisible(tx, caller, input.id, input.kind);
        requireItemPermission(caller, row.kind, "publish");
        return idempotent(tx, caller, "studio.publish", input, async () => {
          if (row.archivedAt !== null || row.draftVersion !== input.expectedVersion) {
            return explainFailedUpdate(tx, caller, row.id);
          }
          const draft = await findVersion(tx, tenantId, row.id, input.expectedVersion);
          if (draft === null) return explainFailedUpdate(tx, caller, row.id);

          if (row.kind === "page") await lockHomepageClaims(tx, tenantId);
          const issues = await validateStudioDocument(
            draft.document,
            createReferenceLookup(tx, tenantId),
          );
          const errors = issues.filter((issue) => issue.severity === "error");
          if (errors.length > 0) {
            throw apiError(
              "validation-failed",
              `The draft has ${errors.length} validation error${errors.length === 1 ? "" : "s"} and cannot be published.`,
              {
                fieldErrors: issuesToFieldErrors(errors),
                details: { errorCount: errors.length, issues: errors },
              },
            );
          }
          const document = parseStoredDocument(draft.document);
          const fields = catalogFieldsOf(document);
          const updated = await withUniqueTranslation(row.kind, () =>
            tx
              .update(def)
              .set({
                publishedVersion: input.expectedVersion,
                draftVersion: null,
                key: fields.key,
                name: fields.name,
                description: fields.description,
                slug: fields.slug,
                updatedAt: caller.at,
                updatedBy: userId,
                rowVersion: sql`${def.rowVersion} + 1`,
              })
              .where(
                and(
                  eq(def.id, row.id),
                  eq(def.tenantId, tenantId),
                  isNull(def.archivedAt),
                  eq(def.draftVersion, input.expectedVersion),
                ),
              )
              .returning({ id: def.id }),
          );
          if (updated.length === 0) return explainFailedUpdate(tx, caller, row.id);

          const published: VersionMetadata = {
            ...metadataOf(draft),
            lifecycle: "published",
            changeSummary: input.changeSummary,
            publishedAt: caller.at,
            publishedBy: userId,
          };
          await tx
            .update(ver)
            .set({
              lifecycle: "published",
              changeSummary: input.changeSummary,
              publishedAt: caller.at,
              publishedBy: userId,
              document: stampDocument(
                document,
                { definitionId: row.id, tenantId, layoutId: null },
                published,
              ),
            })
            .where(
              and(
                eq(ver.definitionId, row.id),
                eq(ver.tenantId, tenantId),
                eq(ver.version, input.expectedVersion),
              ),
            );
          const auditEventId = await appendAudit(tx, caller, {
            kind: row.kind,
            definitionId: row.id,
            operation: "publish",
            previousVersion: row.publishedVersion,
            version: input.expectedVersion,
            changeSummary: input.changeSummary,
          });
          return { id: row.id, version: input.expectedVersion, auditEventId };
        });
      });
    },

    async rollback(context, input: StudioRollbackInput) {
      return run(context, async (tx, caller) => {
        const { tenantId, userId, positionId } = caller.context;
        const row = await requireVisible(tx, caller, input.id, input.kind);
        requireItemPermission(caller, row.kind, "publish");
        return idempotent(tx, caller, "studio.rollback", input, async () => {
          if (row.archivedAt !== null || row.publishedVersion !== input.expectedPublishedVersion) {
            return explainFailedUpdate(tx, caller, row.id);
          }
          const target = await findVersion(tx, tenantId, row.id, input.restoreVersion);
          if (target === null) throw notFound();
          if (target.lifecycle !== "published") {
            throw apiError("validation-failed", "Only published versions can be restored.", {
              fieldErrors: { restoreVersion: ["Version was never published."] },
            });
          }
          // The restored document must still be valid today: references may have been archived and
          // homepage positions claimed since it was published. CEL warnings never block a rollback.
          if (row.kind === "page") await lockHomepageClaims(tx, tenantId);
          const restoreIssues = await validateStudioDocument(
            target.document,
            createReferenceLookup(tx, tenantId),
          );
          const restoreErrors = restoreIssues.filter((issue) => issue.severity === "error");
          if (restoreErrors.length > 0) {
            throw apiError(
              "validation-failed",
              `Version ${input.restoreVersion} has ${restoreErrors.length} validation error${restoreErrors.length === 1 ? "" : "s"} and cannot be restored.`,
              {
                fieldErrors: issuesToFieldErrors(restoreErrors),
                details: { errorCount: restoreErrors.length, issues: restoreErrors },
              },
            );
          }
          const document = parseStoredDocument(target.document);
          const fields = catalogFieldsOf(document);
          const updated = await withUniqueTranslation(row.kind, () =>
            tx
              .update(def)
              .set({
                publishedVersion: sql`${def.latestVersion} + 1`,
                latestVersion: sql`${def.latestVersion} + 1`,
                key: fields.key,
                name: fields.name,
                description: fields.description,
                slug: fields.slug,
                updatedAt: caller.at,
                updatedBy: userId,
                rowVersion: sql`${def.rowVersion} + 1`,
              })
              .where(
                and(
                  eq(def.id, row.id),
                  eq(def.tenantId, tenantId),
                  isNull(def.archivedAt),
                  eq(def.publishedVersion, input.expectedPublishedVersion),
                ),
              )
              .returning({ version: def.latestVersion }),
          );
          const next = updated[0]?.version;
          if (next === undefined) return explainFailedUpdate(tx, caller, row.id);

          const meta: VersionMetadata = {
            version: next,
            lifecycle: "published",
            changeSummary: input.changeSummary,
            createdAt: caller.at,
            createdBy: userId,
            createdPositionId: positionId,
            publishedAt: caller.at,
            publishedBy: userId,
          };
          await tx.insert(ver).values({
            tenantId,
            definitionId: row.id,
            version: next,
            lifecycle: "published",
            document: stampDocument(
              document,
              { definitionId: row.id, tenantId, layoutId: null },
              meta,
            ),
            changeSummary: input.changeSummary,
            createdAt: caller.at,
            createdBy: userId,
            createdPositionId: positionId,
            publishedAt: caller.at,
            publishedBy: userId,
          });
          const auditEventId = await appendAudit(tx, caller, {
            kind: row.kind,
            definitionId: row.id,
            operation: "restore",
            previousVersion: input.expectedPublishedVersion,
            version: next,
            changeSummary: input.changeSummary,
          });
          return { id: row.id, version: next, auditEventId };
        });
      });
    },

    async archive(context, input: StudioArchiveInput) {
      return run(context, async (tx, caller) => {
        const { tenantId, userId } = caller.context;
        const row = await requireVisible(tx, caller, input.id, input.kind);
        requireItemPermission(caller, row.kind, "edit");
        return idempotent(tx, caller, "studio.archive", input, async () => {
          if (row.archivedAt !== null || currentVersionOf(row) !== input.expectedVersion) {
            return explainFailedUpdate(tx, caller, row.id);
          }
          const dependents = await findPublishedDependents(tx, tenantId, row);
          if (dependents.length > 0) {
            throw apiError(
              "dependency-conflict",
              `The ${row.kind} is used by ${dependents.length} published definition${dependents.length === 1 ? "" : "s"} and cannot be archived.`,
              {
                details: {
                  dependents: dependents.map(({ id, kind, name }) => ({ id, kind, name })),
                },
              },
            );
          }
          const updated = await tx
            .update(def)
            .set({
              archivedAt: caller.at,
              updatedAt: caller.at,
              updatedBy: userId,
              rowVersion: sql`${def.rowVersion} + 1`,
            })
            .where(
              and(
                eq(def.id, row.id),
                eq(def.tenantId, tenantId),
                isNull(def.archivedAt),
                sql`coalesce(${def.draftVersion}, ${def.publishedVersion}) = ${input.expectedVersion}`,
              ),
            )
            .returning({ id: def.id });
          if (updated.length === 0) return explainFailedUpdate(tx, caller, row.id);
          const auditEventId = await appendAudit(tx, caller, {
            kind: row.kind,
            definitionId: row.id,
            operation: "archive",
            previousVersion: input.expectedVersion,
            version: input.expectedVersion,
            changeSummary: null,
          });
          return { id: row.id, version: input.expectedVersion, auditEventId };
        });
      });
    },

    async validate(context, input: StudioValidateInput) {
      return run(context, async (tx, caller) => {
        if (!caller.permissions.viewStudio) {
          throw forbidden("Your position is not allowed to validate definitions.");
        }
        const issues = await validateStudioDocument(
          input.document,
          createReferenceLookup(tx, caller.context.tenantId),
        );
        return studioValidateOutputSchema.parse({ issues });
      });
    },
  };
}
