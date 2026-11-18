import {
  type Incident,
  type Position,
  type SelectIncidentInput,
  type SelectPositionInput,
  type SessionSnapshot,
  sessionSnapshotSchema,
} from "@argus/schema";
import { and, asc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { type Transaction, withTenantTransaction } from "../db/transaction.js";
import { apiError } from "../errors.js";
import type { RequestContext } from "../http/request-context.js";
import {
  incidents,
  positions,
  sessionContexts,
  sessionEvents,
  tenants,
  userPositions,
  users,
} from "../persistence/system-schema.js";

export interface SessionServiceDependencies {
  readonly database: Database;
}

/** Session operations behind the `session` tRPC router; every method derives scope from `context`. */
export interface SessionService {
  get(context: RequestContext): Promise<SessionSnapshot>;
  selectPosition(context: RequestContext, input: SelectPositionInput): Promise<SessionSnapshot>;
  selectIncident(context: RequestContext, input: SelectIncidentInput): Promise<SessionSnapshot>;
}

type PositionRow = typeof positions.$inferSelect;
type IncidentRow = typeof incidents.$inferSelect;

function toPosition(row: PositionRow): Position {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    name: row.name,
    description: row.description,
    homepageBoardId: row.homepageBoardId,
    isSystem: row.isSystem,
  };
}

function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    name: row.name,
    kind: row.kind,
    status: row.status,
    level: row.level,
    operationalPeriod: row.operationalPeriod,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validAssignment(now: Date) {
  return and(
    lte(userPositions.validFrom, now),
    or(isNull(userPositions.validTo), sql`${userPositions.validTo} > ${now}`),
  );
}

interface Selection {
  readonly positionId: string;
  readonly incidentId: string | null;
}

/** Build the snapshot for an explicit (position, incident) selection inside a tenant transaction. */
async function loadSnapshot(
  tx: Transaction,
  context: RequestContext,
  selection: Selection,
  now: Date,
): Promise<SessionSnapshot> {
  const [userRow] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, context.userId), eq(users.tenantId, context.tenantId)));
  const [tenantRow] = await tx.select().from(tenants).where(eq(tenants.id, context.tenantId));
  if (userRow === undefined || tenantRow === undefined) {
    throw apiError("unauthenticated", "Authentication is required.");
  }

  const available = await tx
    .select({ position: positions })
    .from(userPositions)
    .innerJoin(
      positions,
      and(
        eq(positions.id, userPositions.positionId),
        eq(positions.tenantId, userPositions.tenantId),
      ),
    )
    .where(
      and(
        eq(userPositions.userId, context.userId),
        eq(userPositions.tenantId, context.tenantId),
        validAssignment(now),
      ),
    )
    .orderBy(asc(positions.key));

  const current = available.find((row) => row.position.id === selection.positionId)?.position;
  if (current === undefined) {
    throw apiError("forbidden", "No position assignment.");
  }

  let activeIncident: Incident | null = null;
  if (selection.incidentId !== null) {
    const [incident] = await tx
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.id, selection.incidentId),
          eq(incidents.tenantId, context.tenantId),
          ne(incidents.status, "archived"),
        ),
      );
    activeIncident = incident === undefined ? null : toIncident(incident);
  }

  return sessionSnapshotSchema.parse({
    user: {
      id: userRow.id,
      tenantId: userRow.tenantId,
      displayName: userRow.displayName,
      email: userRow.email,
      status: userRow.status,
      createdAt: userRow.createdAt.toISOString(),
      updatedAt: userRow.updatedAt.toISOString(),
    },
    tenant: {
      id: tenantRow.id,
      slug: tenantRow.slug,
      name: tenantRow.name,
      status: tenantRow.status,
      createdAt: tenantRow.createdAt.toISOString(),
      updatedAt: tenantRow.updatedAt.toISOString(),
    },
    position: toPosition(current),
    availablePositions: available.map((row) => toPosition(row.position)),
    activeIncident,
    studio: {
      viewStudio: current.studioView,
      editDefinitions: current.studioEdit,
      publishDefinitions: current.studioPublish,
      editCode: current.studioEditCode,
    },
  });
}

function scopeOf(context: RequestContext) {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    positionId: context.positionId,
    requestId: context.requestId,
  };
}

function requireSession(context: RequestContext): string {
  if (context.sessionId === null) {
    throw apiError("forbidden", "An interactive session is required.");
  }
  return context.sessionId;
}

/**
 * Session service over the system catalog. Position and incident selections are verified against
 * current server-side assignments/tenant data, stored in `meta.session_contexts` (optimistic
 * `version`), and audited in `audit.session_events` in the same transaction.
 *
 * Audit row convention: `position_id` is the position the user acts as AFTER the operation;
 * `previous`/`next` hold the changed id (`{positionId}` or `{incidentId}`).
 */
export function createSessionService(dependencies: SessionServiceDependencies): SessionService {
  const { database } = dependencies;

  async function readStoredContext(tx: Transaction, context: RequestContext, sessionId: string) {
    const [stored] = await tx
      .select()
      .from(sessionContexts)
      .where(
        and(
          eq(sessionContexts.authSessionId, sessionId),
          eq(sessionContexts.tenantId, context.tenantId),
          eq(sessionContexts.userId, context.userId),
        ),
      );
    if (stored === undefined) throw apiError("unauthenticated", "Authentication is required.");
    return stored;
  }

  async function writeContext(
    tx: Transaction,
    sessionId: string,
    stored: { version: number },
    values: { positionId?: string; incidentId?: string | null },
  ): Promise<void> {
    const updated = await tx
      .update(sessionContexts)
      .set({ ...values, updatedAt: new Date(), version: stored.version + 1 })
      .where(
        and(
          eq(sessionContexts.authSessionId, sessionId),
          eq(sessionContexts.version, stored.version),
        ),
      )
      .returning({ authSessionId: sessionContexts.authSessionId });
    if (updated.length === 0) {
      throw apiError("dependency-conflict", "The session changed concurrently; retry.");
    }
  }

  return {
    get(context) {
      return withTenantTransaction(database, scopeOf(context), (tx) =>
        loadSnapshot(
          tx,
          context,
          { positionId: context.positionId, incidentId: context.activeIncidentId },
          new Date(),
        ),
      );
    },

    selectPosition(context, input) {
      const sessionId = requireSession(context);
      return withTenantTransaction(database, scopeOf(context), async (tx) => {
        const now = new Date();
        const [assignment] = await tx
          .select({ positionId: userPositions.positionId })
          .from(userPositions)
          .where(
            and(
              eq(userPositions.userId, context.userId),
              eq(userPositions.tenantId, context.tenantId),
              eq(userPositions.positionId, input.positionId),
              validAssignment(now),
            ),
          );
        if (assignment === undefined) throw apiError("not-found", "Position not found.");

        if (input.positionId === context.positionId) {
          return loadSnapshot(
            tx,
            context,
            { positionId: context.positionId, incidentId: context.activeIncidentId },
            now,
          );
        }

        const stored = await readStoredContext(tx, context, sessionId);
        await writeContext(tx, sessionId, stored, { positionId: input.positionId });
        await tx.insert(sessionEvents).values({
          tenantId: context.tenantId,
          userId: context.userId,
          positionId: input.positionId,
          operation: "select-position",
          previous: { positionId: context.positionId },
          next: { positionId: input.positionId },
          requestId: context.requestId,
        });
        return loadSnapshot(
          tx,
          context,
          { positionId: input.positionId, incidentId: context.activeIncidentId },
          now,
        );
      });
    },

    /**
     * TODO(decision): any position in the tenant may select any non-archived incident of that tenant
     * until incident-to-position assignment exists. Product decision needed on who may enter which
     * incident; today only tenant isolation and the archived check apply.
     */
    selectIncident(context, input) {
      const sessionId = requireSession(context);
      return withTenantTransaction(database, scopeOf(context), async (tx) => {
        const now = new Date();
        if (input.incidentId !== null) {
          const [incident] = await tx
            .select({ id: incidents.id })
            .from(incidents)
            .where(
              and(
                eq(incidents.id, input.incidentId),
                eq(incidents.tenantId, context.tenantId),
                ne(incidents.status, "archived"),
              ),
            );
          if (incident === undefined) throw apiError("not-found", "Incident not found.");
        }

        if (input.incidentId === context.activeIncidentId) {
          return loadSnapshot(
            tx,
            context,
            { positionId: context.positionId, incidentId: context.activeIncidentId },
            now,
          );
        }

        const stored = await readStoredContext(tx, context, sessionId);
        await writeContext(tx, sessionId, stored, { incidentId: input.incidentId });
        await tx.insert(sessionEvents).values({
          tenantId: context.tenantId,
          userId: context.userId,
          positionId: context.positionId,
          operation: "select-incident",
          previous: { incidentId: context.activeIncidentId },
          next: { incidentId: input.incidentId },
          requestId: context.requestId,
        });
        return loadSnapshot(
          tx,
          context,
          { positionId: context.positionId, incidentId: input.incidentId },
          now,
        );
      });
    },
  };
}
