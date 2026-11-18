import { fileURLToPath } from "node:url";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { DatabaseHandle } from "./client.js";

/** Migration folder, resolved relative to this file so it works from `src` (tsx) and `dist`. */
export const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

/**
 * Apply all pending Drizzle migrations from `apps/api/migrations`. Idempotent: already-applied
 * migrations are skipped (tracked in `drizzle.__drizzle_migrations`).
 *
 * Run as a migration-capable role (the table owner). Application traffic must use the least-privilege
 * `argus_app` role through `withTenantTransaction`, never this connection.
 */
export async function runMigrations(database: DatabaseHandle): Promise<void> {
  if (database.driver === "pglite") {
    await migratePglite(database.db as unknown as PgliteDatabase, { migrationsFolder });
    return;
  }
  await migratePostgres(database.db as unknown as PostgresJsDatabase, { migrationsFolder });
}
