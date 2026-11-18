# System database migrations

No migration is implemented yet. `src/persistence/system-schema.ts` contains intentionally incomplete Drizzle table placeholders, not a deployable schema.

Create reviewed, forward-only Drizzle migrations in this directory after the catalog contracts are agreed. Each migration must include a rollback/recovery note and be tested against PostgreSQL 18 with PostGIS.

Mandatory controls for every tenant-owned table:

- Enable and force RLS, including for table owners used by application connections; migration owners must be separate.
- Derive policies from transaction-local, server-authenticated tenant, user, position, and incident claims. Do not trust arbitrary client-set claims.
- Deny exercise/live and cross-incident access unless the table is explicitly global and policy allows it.
- Apply column/field privileges alongside API field-level filtering. Sensitive fields require explicit read and write grants.
- Use separate least-privilege runtime, migration, reporting, and sync roles. Reporting and sync paths must preserve RLS and FLS.
- Add optimistic `version` checks, soft-delete semantics, immutable audit triggers, and append-only audit partitioning before live writes.
- Never put tenant IDs, table names, field names, CEL, or values into dynamically generated SQL without the DDL engine's identifier and parameter controls.

Add integration tests with two tenants, two incidents, multiple positions, global and incident-scoped tables, sensitive fields, soft-deleted rows, and concurrent version conflicts before enabling any endpoint.
