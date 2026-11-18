# System database migrations

Schema source: `src/persistence/system-schema.ts`. Generate with `pnpm --filter @argus/api db:generate` (SQL only, no database needed), review the SQL, add hand-written parts with `drizzle-kit generate --custom`, apply with `pnpm --filter @argus/api db:migrate` (or `runMigrations`). Migrations are forward-only and must not be edited once applied. Each migration carries a rollback/recovery note below.

Verification status: applied and exercised on PGlite 0.5.15 (reports PostgreSQL 18.6, compiled to WASM; no PostGIS) only. Applying them to PostgreSQL 18 + PostGIS (Testcontainers) is `TODO(verify)` until Docker is available.

## Migrations

### 0000_superb_wendell_rand (generated)

Creates schemas `meta`, `audit`, `auth` and the catalog tables for tenants, users, positions, user positions, incidents, session contexts, studio definitions and versions, idempotency keys, API keys (placeholder), Better Auth tables and the audit tables.

Rollback/recovery: pre-production only. Roll back by dropping schemas `audit`, `meta`, `auth` (`DROP SCHEMA ... CASCADE`) and deleting the `drizzle.__drizzle_migrations` rows, or restore the database from backup. After data exists, never drop: write a new forward migration.

### 0001_rls_roles_audit_identity (hand-written)

Creates NOLOGIN roles `argus_app` (runtime) and `argus_identity` (owner of the identity lookup); grants `argus_app` DML on `meta` tables and SELECT/INSERT only on `audit` tables (nothing on `auth`); enables and forces RLS with tenant policies (`tenant_id = nullif(current_setting('argus.tenant_id', true), '')::uuid`, USING and WITH CHECK) on every tenant-owned table; installs the append-only trigger on audit tables (UPDATE, DELETE and TRUNCATE are rejected for every role); installs `meta.resolve_identity(text)` as the only pre-tenant lookup (SECURITY DEFINER, owned by `argus_identity` whose only visibility into `meta.users` is a SELECT policy, `search_path` pinned, execute granted to `argus_app` only).

New tenant-owned tables must be added to this list in a new migration (grants are explicit per table so omissions fail closed) and to `tenantOwnedTableNames`; the persistence test fails if a `tenant_id` table lacks forced RLS.

Operational notes: the connection used for migrations and `withSystemTransaction` (fixtures, seed, identity bootstrap) must be a superuser or a role with `BYPASSRLS` and must be able to `GRANT argus_identity` to itself; PGlite connects as superuser. Runtime connections must be able to `SET ROLE argus_app` (grant membership of `argus_app` to the runtime login role).

Rollback/recovery: pre-production only. Reverse order: `DROP FUNCTION meta.resolve_identity(text)`, drop triggers and `audit.reject_mutation()`, `DROP POLICY` / `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY, DISABLE ROW LEVEL SECURITY` on each table, `REVOKE` the grants, then `DROP ROLE argus_identity, argus_app` (roles are cluster-global: only drop when no other database uses them). Disabling RLS in a live system exposes cross-tenant data: prefer a forward fix or restoring from backup.

Mandatory controls for every tenant-owned table:

- Enable and force RLS, including for table owners used by application connections; migration owners must be separate.
- Derive policies from transaction-local, server-authenticated tenant, user, position, and incident claims. Do not trust arbitrary client-set claims.
- Deny exercise/live and cross-incident access unless the table is explicitly global and policy allows it.
- Apply column/field privileges alongside API field-level filtering. Sensitive fields require explicit read and write grants.
- Use separate least-privilege runtime, migration, reporting, and sync roles. Reporting and sync paths must preserve RLS and FLS.
- Add optimistic `version` checks, soft-delete semantics, immutable audit triggers, and append-only audit partitioning before live writes.
- Never put tenant IDs, table names, field names, CEL, or values into dynamically generated SQL without the DDL engine's identifier and parameter controls.

Add integration tests with two tenants, two incidents, multiple positions, global and incident-scoped tables, sensitive fields, soft-deleted rows, and concurrent version conflicts before enabling any endpoint.
