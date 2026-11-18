import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DatabaseHandle, resultRows } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { withSystemTransaction, withTenantTransaction } from "../src/db/transaction.js";
import {
  authUser,
  definitionChanges,
  positions,
  tenantOwnedTableNames,
  tenants,
  userPositions,
  users,
} from "../src/persistence/system-schema.js";
import {
  assignPosition,
  createPosition,
  createTenant,
  createTenantWithUser,
  createTestDatabase,
  createUser,
} from "./helpers/index.js";

/** Drizzle wraps driver errors; collect the whole chain so assertions see the database message. */
function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" | ");
}

async function expectRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error, "expected the operation to be rejected").not.toBeNull();
  expect(errorText(error)).toMatch(pattern);
}

describe("system catalog persistence", () => {
  let database: DatabaseHandle;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  describe("tenant row-level security", () => {
    it("hides other tenants' rows inside a tenant transaction even without a tenant predicate", async () => {
      const a = await createTenantWithUser(database);
      const b = await createTenantWithUser(database);

      const seenByA = await withTenantTransaction(database.db, a.scope, async (tx) => ({
        positions: await tx
          .select({ id: positions.id, tenantId: positions.tenantId })
          .from(positions),
        users: await tx.select({ id: users.id }).from(users),
        tenants: await tx.select({ id: tenants.id }).from(tenants),
        raw: await tx.execute(sql`select tenant_id from meta.user_positions`),
      }));

      expect(seenByA.positions.map((row) => row.id)).toEqual([a.position.id]);
      expect(seenByA.positions.every((row) => row.tenantId === a.tenant.id)).toBe(true);
      expect(seenByA.users.map((row) => row.id)).toEqual([a.user.id]);
      expect(seenByA.tenants.map((row) => row.id)).toEqual([a.tenant.id]);
      expect(resultRows(seenByA.raw)).toHaveLength(1);

      const seenByB = await withTenantTransaction(database.db, b.scope, (tx) =>
        tx.select({ id: positions.id }).from(positions),
      );
      expect(seenByB.map((row) => row.id)).toEqual([b.position.id]);
    });

    it("returns no rows and cannot modify rows of another tenant", async () => {
      const a = await createTenantWithUser(database);
      const b = await createTenantWithUser(database);

      const updated = await withTenantTransaction(database.db, a.scope, (tx) =>
        tx
          .update(positions)
          .set({ name: "hijacked" })
          .where(eq(positions.id, b.position.id))
          .returning({ id: positions.id }),
      );
      expect(updated).toEqual([]);

      const deleted = await withTenantTransaction(database.db, a.scope, (tx) =>
        tx.delete(users).where(eq(users.id, b.user.id)).returning({ id: users.id }),
      );
      expect(deleted).toEqual([]);

      const untouched = await withSystemTransaction(database.db, (tx) =>
        tx.select({ name: positions.name }).from(positions).where(eq(positions.id, b.position.id)),
      );
      expect(untouched[0]?.name).toBe(b.position.name);
    });

    it("rejects an insert whose tenant_id does not match the transaction's tenant (WITH CHECK)", async () => {
      const a = await createTenantWithUser(database);
      const b = await createTenantWithUser(database);

      await expectRejection(
        withTenantTransaction(database.db, a.scope, (tx) =>
          tx.insert(positions).values({
            tenantId: b.tenant.id,
            key: "smuggled",
            name: "Smuggled into tenant B",
          }),
        ),
        /row-level security|new row violates/i,
      );

      const smuggled = await withSystemTransaction(database.db, (tx) =>
        tx.select({ id: positions.id }).from(positions).where(eq(positions.key, "smuggled")),
      );
      expect(smuggled).toEqual([]);
    });

    it("denies all rows to argus_app when no tenant claim is set", async () => {
      await createTenantWithUser(database);
      const rows = await withSystemTransaction(database.db, async (tx) => {
        await tx.execute(sql`set local role argus_app`);
        return tx.select({ id: positions.id }).from(positions);
      });
      expect(rows).toEqual([]);
    });

    it("does not leak tenant claims to the next transaction on the same connection", async () => {
      const a = await createTenantWithUser(database);
      await withTenantTransaction(database.db, a.scope, (tx) => tx.select().from(positions));
      const claim = await withSystemTransaction(database.db, (tx) =>
        tx.execute(
          sql`select current_setting('argus.tenant_id', true) as value, current_user as role`,
        ),
      );
      const row = resultRows<{ value: string | null; role: string }>(claim)[0];
      if (row === undefined) throw new Error("no row");
      expect(row.value ?? "").toBe("");
      expect(row.role).not.toBe("argus_app");
    });

    it("keeps references inside one tenant (composite foreign keys)", async () => {
      const a = await createTenantWithUser(database);
      const other = await createTenant(database);
      const foreignPosition = await createPosition(database, other.id);

      await expectRejection(
        assignPosition(database, {
          tenantId: a.tenant.id,
          userId: a.user.id,
          positionId: foreignPosition.id,
        }),
        /foreign key|violates/i,
      );
    });

    it("enables and forces RLS on every table that has a tenant_id column", async () => {
      const result = await withSystemTransaction(database.db, (tx) =>
        tx.execute(sql`
          select c.table_schema || '.' || c.table_name as name, r.relrowsecurity as enabled, r.relforcerowsecurity as forced
          from information_schema.columns c
          join pg_catalog.pg_class r on r.oid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass
          where c.column_name = 'tenant_id' and c.table_schema in ('meta', 'audit')
          order by 1`),
      );
      const rows = resultRows<{ name: string; enabled: boolean; forced: boolean }>(result);
      expect(rows.map((row) => row.name).sort()).toEqual([...tenantOwnedTableNames].sort());
      for (const row of rows) {
        expect(row.enabled, `${row.name} RLS enabled`).toBe(true);
        expect(row.forced, `${row.name} RLS forced`).toBe(true);
      }
    });
  });

  describe("least-privilege role", () => {
    it("has no access to the auth schema", async () => {
      const a = await createTenantWithUser(database);
      await expectRejection(
        withTenantTransaction(database.db, a.scope, (tx) => tx.select().from(authUser)),
        /permission denied/i,
      );
    });

    it("can only INSERT and SELECT audit tables", async () => {
      const a = await createTenantWithUser(database);
      await expectRejection(
        withTenantTransaction(database.db, a.scope, (tx) =>
          tx.execute(sql`update audit.definition_changes set change_summary = 'x'`),
        ),
        /permission denied/i,
      );
      await expectRejection(
        withTenantTransaction(database.db, a.scope, (tx) =>
          tx.execute(sql`delete from audit.definition_changes`),
        ),
        /permission denied/i,
      );
    });
  });

  describe("append-only audit", () => {
    async function insertAuditRow() {
      const a = await createTenantWithUser(database);
      const definitionId = randomUUID();
      const [row] = await withTenantTransaction(database.db, a.scope, (tx) =>
        tx
          .insert(definitionChanges)
          .values({
            tenantId: a.tenant.id,
            definitionKind: "board",
            definitionId,
            previousVersion: null,
            version: 1,
            operation: "create-draft",
            changeSummary: null,
            actorUserId: a.user.id,
            actorPositionId: a.position.id,
            requestId: a.scope.requestId,
            correlationId: a.scope.requestId,
          })
          .returning({ id: definitionChanges.id }),
      );
      if (row === undefined) throw new Error("audit insert returned no row");
      return { a, id: row.id };
    }

    it("lets the tenant write and read its own audit rows", async () => {
      const { a, id } = await insertAuditRow();
      const visible = await withTenantTransaction(database.db, a.scope, (tx) =>
        tx.select({ id: definitionChanges.id }).from(definitionChanges),
      );
      expect(visible.map((row) => row.id)).toEqual([id]);

      const other = await createTenantWithUser(database);
      const hidden = await withTenantTransaction(database.db, other.scope, (tx) =>
        tx.select({ id: definitionChanges.id }).from(definitionChanges),
      );
      expect(hidden).toEqual([]);
    });

    it("rejects UPDATE and DELETE even in a system transaction", async () => {
      const { id } = await insertAuditRow();
      await expectRejection(
        withSystemTransaction(database.db, (tx) =>
          tx
            .update(definitionChanges)
            .set({ changeSummary: "tampered" })
            .where(eq(definitionChanges.id, id)),
        ),
        /append-only/i,
      );
      await expectRejection(
        withSystemTransaction(database.db, (tx) =>
          tx.delete(definitionChanges).where(eq(definitionChanges.id, id)),
        ),
        /append-only/i,
      );
      await expectRejection(
        withSystemTransaction(database.db, (tx) =>
          tx.execute(sql`truncate audit.definition_changes`),
        ),
        /append-only/i,
      );
    });
  });

  describe("identity resolution", () => {
    it("resolves an auth user to tenant and user through the SECURITY DEFINER function only", async () => {
      const tenant = await createTenant(database);
      const authUserId = `auth_${randomUUID()}`;
      await withSystemTransaction(database.db, (tx) =>
        tx.insert(authUser).values({
          id: authUserId,
          name: "Fixture",
          email: `${authUserId}@example.test`,
        }),
      );
      const user = await createUser(database, tenant.id, { authUserId });

      const scopeless = await withSystemTransaction(database.db, async (tx) => {
        await tx.execute(sql`set local role argus_app`);
        const known = await tx.execute(sql`select * from meta.resolve_identity(${authUserId})`);
        const unknown = await tx.execute(sql`select * from meta.resolve_identity(${"nope"})`);
        // Direct table access without a tenant claim still yields nothing.
        const direct = await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id));
        return { known: resultRows(known), unknown: resultRows(unknown), direct };
      });

      expect(scopeless.known).toEqual([
        { tenant_id: tenant.id, user_id: user.id, status: "active" },
      ]);
      expect(scopeless.unknown).toEqual([]);
      expect(scopeless.direct).toEqual([]);
    });
  });

  describe("migrations", () => {
    it("are idempotent: running twice applies nothing new", async () => {
      const count = async () => {
        const result = await withSystemTransaction(database.db, (tx) =>
          tx.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`),
        );
        return Number(resultRows<{ n: number }>(result)[0]?.n);
      };
      const before = await count();
      await runMigrations(database);
      await runMigrations(database);
      expect(await count()).toBe(before);
      expect(before).toBeGreaterThanOrEqual(2);
    });

    it("keep user_positions primary key on (user, position)", async () => {
      const a = await createTenantWithUser(database);
      await expectRejection(
        assignPosition(database, {
          tenantId: a.tenant.id,
          userId: a.user.id,
          positionId: a.position.id,
        }),
        /duplicate key|unique/i,
      );
      const rows = await withSystemTransaction(database.db, (tx) =>
        tx.select().from(userPositions).where(eq(userPositions.userId, a.user.id)),
      );
      expect(rows).toHaveLength(1);
    });
  });

  // Needs PostgreSQL 18 + PostGIS (Testcontainers) or user tables from the DDL engine; not covered here.
  it.todo("enforces incident scope and explicit global-table policy at the database boundary");
  it.todo("applies field-level read/write policy to sensitive values and generated REST responses");
  it.todo("writes append-only field diffs with actor, position, incident, and request attribution");
  it.todo("rejects stale optimistic versions without losing either writer's field-level changes");
  it.todo("uses only DDL-engine plans for physical user-table migration and parameterized values");
  it.todo(
    "runs the same migrations and RLS suite against PostgreSQL 18 + PostGIS (Testcontainers)",
  );
});
