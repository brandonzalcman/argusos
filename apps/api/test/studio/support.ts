import { randomUUID } from "node:crypto";
import type {
  ApiErrorCode,
  OperationContext,
  StudioCreateInput,
  StudioDocument,
  StudioGetOutput,
  StudioMutationOutput,
} from "@argus/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { expect } from "vitest";
import type { DatabaseHandle } from "../../src/db/client.js";
import { withSystemTransaction } from "../../src/db/transaction.js";
import { ApiRequestError } from "../../src/errors.js";
import {
  definitionChanges,
  studioDefinitions,
  studioDefinitionVersions,
} from "../../src/persistence/system-schema.js";
import type { StudioService } from "../../src/studio/service.js";
import {
  assignPosition,
  createPosition,
  createTenant,
  createUser,
  type StudioPermissionColumns,
} from "../helpers/index.js";

export const NIL_META = {
  version: 1,
  lifecycle: "draft" as const,
  changeSummary: null,
  createdAt: "2001-01-01T00:00:00.000Z",
  createdBy: "11111111-1111-4111-8111-111111111111",
  createdPositionId: "11111111-1111-4111-8111-111111111111",
  publishedAt: null,
  publishedBy: null,
};

export interface Actor {
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string;
  readonly context: () => OperationContext;
}

export const ALL_PERMISSIONS: StudioPermissionColumns = {
  studioView: true,
  studioEdit: true,
  studioPublish: true,
  studioEditCode: true,
};

export function contextOf(base: {
  tenantId: string;
  userId: string;
  positionId: string;
}): OperationContext {
  return {
    tenantId: base.tenantId,
    userId: base.userId,
    positionId: base.positionId,
    incidentId: null,
    requestId: randomUUID(),
    authenticatedAt: new Date().toISOString(),
  };
}

/** Adds a user with its own position (and permissions) to an existing tenant. */
export async function addActor(
  database: DatabaseHandle,
  tenantId: string,
  permissions: Partial<StudioPermissionColumns> = {},
): Promise<Actor> {
  const user = await createUser(database, tenantId);
  const position = await createPosition(database, tenantId, permissions);
  await assignPosition(database, { tenantId, userId: user.id, positionId: position.id });
  return {
    tenantId,
    userId: user.id,
    positionId: position.id,
    context: () => contextOf({ tenantId, userId: user.id, positionId: position.id }),
  };
}

export async function createTenantActor(
  database: DatabaseHandle,
  permissions: Partial<StudioPermissionColumns> = ALL_PERMISSIONS,
): Promise<Actor> {
  const tenant = await createTenant(database);
  return addActor(database, tenant.id, permissions);
}

let keyCounter = 0;
export function uniqueKey(prefix = "def"): string {
  keyCounter += 1;
  return `${prefix}_${keyCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function idemKey(): string {
  return `idem-${randomUUID()}`;
}

export function createInput(
  overrides: Partial<StudioCreateInput> & { kind: StudioCreateInput["kind"] },
): StudioCreateInput {
  return {
    key: uniqueKey(overrides.kind),
    name: `Test ${overrides.kind}`,
    template: { type: "blank" },
    idempotencyKey: idemKey(),
    ...overrides,
  };
}

/** create + (optionally) publish a blank page/component; returns ids and the draft document. */
export async function createAndGet(
  service: StudioService,
  actor: Actor,
  input: Partial<StudioCreateInput> & { kind: "page" | "component" },
): Promise<{ created: StudioMutationOutput; draft: StudioGetOutput }> {
  const created = await service.create(actor.context(), createInput(input));
  const draft = await service.get(actor.context(), {
    kind: input.kind,
    id: created.id,
    revision: "draft",
  });
  if (draft === null) throw new Error("expected a draft");
  return { created, draft };
}

export async function createAndPublish(
  service: StudioService,
  actor: Actor,
  input: Partial<StudioCreateInput> & { kind: "page" | "component" },
): Promise<{ id: string; version: number; draft: StudioGetOutput }> {
  const { created, draft } = await createAndGet(service, actor, input);
  const published = await service.publish(actor.context(), {
    kind: input.kind,
    id: created.id,
    expectedVersion: created.version,
    changeSummary: "initial publish",
    idempotencyKey: idemKey(),
  });
  return { id: created.id, version: published.version, draft };
}

export function boardDocument(options: {
  id?: string;
  key?: string;
  tenantId?: string;
  access?: { positionIds: string[]; visibilityRule: string | null };
}): StudioDocument & { kind: "board" } {
  const id = options.id ?? randomUUID();
  const layoutId = randomUUID();
  const tenantId = options.tenantId ?? randomUUID();
  const meta = { ...NIL_META, tenantId };
  return {
    kind: "board",
    bundle: {
      definition: {
        ...meta,
        id,
        key: options.key ?? uniqueKey("board"),
        name: "Seeded board",
        description: null,
        dataSources: [{ alias: "items", tableId: randomUUID(), filterExpression: null }],
        views: [
          {
            id: randomUUID(),
            viewId: randomUUID(),
            name: "All",
            access: { positionIds: [], visibilityRule: null },
          },
        ],
        blocks: [],
        layoutId,
        access: options.access ?? { positionIds: [], visibilityRule: null },
      },
      layout: {
        ...meta,
        id: layoutId,
        name: "Layout",
        boardId: id,
        positionId: null,
        columns: 12,
        layouts: [{ breakpoint: "desktop", items: [] }],
      },
    },
  };
}

/** Insert a published board straight into the catalog (blank boards cannot be created via the API). */
export async function seedPublishedBoard(
  database: DatabaseHandle,
  actor: Actor,
  options: { access?: { positionIds: string[]; visibilityRule: string | null } } = {},
): Promise<{ id: string }> {
  const id = randomUUID();
  const document = boardDocument({ id, tenantId: actor.tenantId, ...options });
  const now = new Date();
  await withSystemTransaction(database.db, async (tx) => {
    await tx.insert(studioDefinitions).values({
      id,
      tenantId: actor.tenantId,
      kind: "board",
      key: document.bundle.definition.key,
      name: document.bundle.definition.name,
      description: null,
      slug: null,
      draftVersion: null,
      publishedVersion: 1,
      latestVersion: 1,
      createdAt: now,
      createdBy: actor.userId,
      updatedAt: now,
      updatedBy: actor.userId,
    });
    await tx.insert(studioDefinitionVersions).values({
      tenantId: actor.tenantId,
      definitionId: id,
      version: 1,
      lifecycle: "published",
      document,
      changeSummary: "seed",
      createdAt: now,
      createdBy: actor.userId,
      createdPositionId: actor.positionId,
      publishedAt: now,
      publishedBy: actor.userId,
    });
  });
  return { id };
}

/** Audit rows for one definition, oldest first (system read, no tenant claims). */
export async function auditRowsFor(
  database: DatabaseHandle,
  tenantId: string,
  definitionId: string,
) {
  return withSystemTransaction(database.db, (tx) =>
    tx
      .select()
      .from(definitionChanges)
      .where(
        and(
          eq(definitionChanges.tenantId, tenantId),
          eq(definitionChanges.definitionId, definitionId),
        ),
      )
      .orderBy(definitionChanges.occurredAt, definitionChanges.version),
  );
}

export async function versionRowsFor(database: DatabaseHandle, definitionId: string) {
  return withSystemTransaction(database.db, (tx) =>
    tx
      .select()
      .from(studioDefinitionVersions)
      .where(eq(studioDefinitionVersions.definitionId, definitionId))
      .orderBy(studioDefinitionVersions.version),
  );
}

/** Await a promise that must reject with an `apiError` of the given code. */
export async function expectApiError(
  promise: Promise<unknown>,
  code: ApiErrorCode,
): Promise<ApiRequestError> {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught, `expected ${code} rejection`).toBeInstanceOf(TRPCError);
  const cause = (caught as TRPCError).cause;
  expect(cause).toBeInstanceOf(ApiRequestError);
  expect((cause as ApiRequestError).code).toBe(code);
  return cause as ApiRequestError;
}
