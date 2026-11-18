import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

/** Drizzle transaction handle (same query API as `Database`). */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Server-authenticated claims applied to one database transaction. Never built from client input. */
export interface TenantScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly positionId: string;
  readonly requestId: string;
}

/**
 * Run `fn` in a transaction that is subject to tenant row-level security.
 *
 * The transaction does `SET LOCAL ROLE argus_app` (a least-privilege, non-owner role, so RLS and the
 * grants apply even when the connection user is a superuser, as in PGlite) and sets the
 * transaction-local claims `argus.tenant_id`, `argus.user_id`, `argus.position_id` and
 * `argus.request_id` with bound parameters. Role and claims revert automatically at commit/rollback,
 * so they cannot leak to the next pooled use of the connection.
 */
export async function withTenantTransaction<T>(
  database: Database,
  scope: TenantScope,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local role argus_app`);
    await tx.execute(
      sql`select
        set_config('argus.tenant_id', ${scope.tenantId}, true),
        set_config('argus.user_id', ${scope.userId}, true),
        set_config('argus.position_id', ${scope.positionId}, true),
        set_config('argus.request_id', ${scope.requestId}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Run `fn` in a transaction with the connection user's own privileges and NO tenant claims.
 *
 * Only for infrastructure that has no tenant yet or manages the catalog itself: identity resolution
 * (`meta.resolve_identity`), migrations, seeding and test fixtures. Request handlers must never call
 * this; they use {@link withTenantTransaction}. Audit tables remain append-only here too (trigger).
 */
export async function withSystemTransaction<T>(
  database: Database,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return database.transaction(fn);
}
