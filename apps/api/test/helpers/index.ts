import { createDatabase, type DatabaseHandle } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import { type Transaction, withSystemTransaction } from "../../src/db/transaction.js";
import {
  incidents,
  positions,
  tenants,
  userPositions,
  users,
} from "../../src/persistence/system-schema.js";

/** Fresh, fully migrated, in-memory PGlite database. Call `close()` in `afterAll`. */
export async function createTestDatabase(): Promise<DatabaseHandle> {
  const handle = await createDatabase("pglite:memory");
  await runMigrations(handle);
  return handle;
}

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestTenant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface TestUser {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
}

export interface StudioPermissionColumns {
  readonly studioView: boolean;
  readonly studioEdit: boolean;
  readonly studioPublish: boolean;
  readonly studioEditCode: boolean;
}

export interface TestPosition extends StudioPermissionColumns {
  readonly id: string;
  readonly tenantId: string;
  readonly key: string;
  readonly name: string;
}

type Fixtures = Pick<DatabaseHandle, "db">;

/** Fixture writers use a system transaction (no tenant claims); they are test-only. */
export async function createTenant(
  database: Fixtures,
  overrides: { slug?: string; name?: string } = {},
): Promise<TestTenant> {
  const slug = overrides.slug ?? unique("tenant");
  const name = overrides.name ?? `Tenant ${slug}`;
  const [row] = await withSystemTransaction(database.db, (tx: Transaction) =>
    tx.insert(tenants).values({ slug, name }).returning({ id: tenants.id }),
  );
  if (row === undefined) throw new Error("createTenant: no row returned");
  return { id: row.id, slug, name };
}

export async function createUser(
  database: Fixtures,
  tenantId: string,
  overrides: {
    displayName?: string;
    email?: string | null;
    authUserId?: string | null;
    status?: "invited" | "active" | "disabled";
  } = {},
): Promise<TestUser> {
  const displayName = overrides.displayName ?? unique("User");
  const [row] = await withSystemTransaction(database.db, (tx: Transaction) =>
    tx
      .insert(users)
      .values({
        tenantId,
        displayName,
        email: overrides.email ?? null,
        authUserId: overrides.authUserId ?? null,
        status: overrides.status ?? "active",
      })
      .returning({ id: users.id }),
  );
  if (row === undefined) throw new Error("createUser: no row returned");
  return { id: row.id, tenantId, displayName };
}

export async function createPosition(
  database: Fixtures,
  tenantId: string,
  permissions: Partial<StudioPermissionColumns> & { key?: string; name?: string } = {},
): Promise<TestPosition> {
  const key = permissions.key ?? unique("position");
  const name = permissions.name ?? `Position ${key}`;
  const flags: StudioPermissionColumns = {
    studioView: permissions.studioView ?? false,
    studioEdit: permissions.studioEdit ?? false,
    studioPublish: permissions.studioPublish ?? false,
    studioEditCode: permissions.studioEditCode ?? false,
  };
  const [row] = await withSystemTransaction(database.db, (tx: Transaction) =>
    tx
      .insert(positions)
      .values({ tenantId, key, name, ...flags })
      .returning({ id: positions.id }),
  );
  if (row === undefined) throw new Error("createPosition: no row returned");
  return { id: row.id, tenantId, key, name, ...flags };
}

export async function assignPosition(
  database: Fixtures,
  assignment: {
    tenantId: string;
    userId: string;
    positionId: string;
    validFrom?: Date;
    validTo?: Date | null;
  },
): Promise<void> {
  await withSystemTransaction(database.db, (tx: Transaction) =>
    tx.insert(userPositions).values({
      tenantId: assignment.tenantId,
      userId: assignment.userId,
      positionId: assignment.positionId,
      validFrom: assignment.validFrom ?? new Date(Date.now() - 60_000),
      validTo: assignment.validTo ?? null,
    }),
  );
}

export async function createIncident(
  database: Fixtures,
  tenantId: string,
  overrides: {
    key?: string;
    name?: string;
    kind?: "live" | "exercise";
    status?: "planned" | "active" | "monitoring" | "closed" | "archived";
  } = {},
): Promise<{ id: string; tenantId: string; key: string }> {
  const key = overrides.key ?? unique("incident");
  const [row] = await withSystemTransaction(database.db, (tx: Transaction) =>
    tx
      .insert(incidents)
      .values({
        tenantId,
        key,
        name: overrides.name ?? `Incident ${key}`,
        kind: overrides.kind ?? "exercise",
        status: overrides.status ?? "planned",
      })
      .returning({ id: incidents.id }),
  );
  if (row === undefined) throw new Error("createIncident: no row returned");
  return { id: row.id, tenantId, key };
}

/** A tenant with one user holding one position, ready for `withTenantTransaction` scopes. */
export async function createTenantWithUser(
  database: Fixtures,
  permissions: Partial<StudioPermissionColumns> = {},
) {
  const tenant = await createTenant(database);
  const user = await createUser(database, tenant.id);
  const position = await createPosition(database, tenant.id, permissions);
  await assignPosition(database, { tenantId: tenant.id, userId: user.id, positionId: position.id });
  return {
    tenant,
    user,
    position,
    scope: {
      tenantId: tenant.id,
      userId: user.id,
      positionId: position.id,
      requestId: crypto.randomUUID(),
    },
  };
}
