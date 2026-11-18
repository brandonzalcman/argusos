import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Driver-agnostic Drizzle database. Both the PGlite and postgres.js drivers extend `PgDatabase`,
 * so services depend on this type and never on a concrete driver.
 */
export type Database = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export type DatabaseDriver = "pglite" | "postgres";

export interface DatabaseHandle {
  readonly db: Database;
  readonly driver: DatabaseDriver;
  /** Underlying driver client; for migrations and diagnostics only. */
  readonly raw: PGlite | postgres.Sql;
  /** Releases the connection pool / WASM instance. Safe to call more than once. */
  close(): Promise<void>;
}

/**
 * Create a database from a URL: `postgresql://…` (postgres.js), `pglite:<dir>` (persistent PGlite,
 * local development only) or `pglite:memory` (ephemeral PGlite, tests).
 * Errors: throws for unsupported schemes; the message never includes the URL (it may hold credentials).
 */
export async function createDatabase(url: string): Promise<DatabaseHandle> {
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    const client = postgres(url, { max: 10, onnotice: () => undefined });
    const db = drizzlePostgres({ client });
    let closed = false;
    return {
      db,
      driver: "postgres",
      raw: client,
      async close() {
        if (closed) return;
        closed = true;
        await client.end({ timeout: 5 });
      },
    };
  }
  if (url.startsWith("pglite:") && url.length > "pglite:".length) {
    const location = url.slice("pglite:".length);
    const client = location === "memory" ? new PGlite() : new PGlite(location);
    await client.waitReady;
    const db = drizzlePglite({ client });
    let closed = false;
    return {
      db,
      driver: "pglite",
      raw: client,
      async close() {
        if (closed) return;
        closed = true;
        await client.close();
      },
    };
  }
  throw new Error(
    "Unsupported database URL: expected postgresql://, pglite:<dir> or pglite:memory",
  );
}

/**
 * Rows of a raw `tx.execute(sql`...`)` result. PGlite returns `{ rows }`, postgres.js returns the row
 * array itself; this normalizes both so callers stay driver-agnostic. Rows are untyped: validate them.
 */
export function resultRows<T extends Record<string, unknown> = Record<string, unknown>>(
  result: unknown,
): T[] {
  if (Array.isArray(result)) return result as T[];
  if (typeof result === "object" && result !== null && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
