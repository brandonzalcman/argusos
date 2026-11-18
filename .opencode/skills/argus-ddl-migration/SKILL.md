---

name: argus-ddl-migration
description: Rules for database changes in ArgusOS — Drizzle migrations for system tables and the DDL engine for user-built tables, including audit triggers and row-level security. Load for any schema, migration or SQL work.
---

# Database changes

## Two kinds of tables

| Kind                                                          | Where                                    | How to change                                                                           |
| ------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| System tables (`meta.*`, `audit.*`, auth, tenants, incidents) | `apps/api/src/db/schema/*.ts`            | Drizzle schema + `pnpm --filter @argus/api db:generate` → review SQL → commit migration |
| User tables (`data.t_<id>`)                                   | Defined in `meta.tables` / `meta.fields` | Only through `@argus/ddl-engine`: `planMigration` → `applyMigration`                    |

## User table system columns (always present)

`id uuid default uuidv7()`, `incident_id`, `created_at`, `created_by`, `created_position`, `updated_at`, `updated_by`, `version int`, `deleted_at`, `search tsvector` (generated).

## Every user table gets

1. **RLS:** `ENABLE ROW LEVEL SECURITY` + policies reading `current_setting('argus.user_id')`, `argus.position_id`, `argus.incident_id`. The API sets these per transaction with `SET LOCAL`.
2. **Audit trigger:** `AFTER INSERT OR UPDATE OR DELETE` writing a field-level diff to `audit.record_changes` (use `OLD`/`NEW`).
3. **Change feed:** included in the logical replication publication `argus_changes`.
4. **View:** `data.v_<id>` adding lookup/rollup/formula columns.

## Safety rules

- One migration = one transaction. Large type changes use: add new column → backfill in batches → swap → soft-delete old.
- Destructive steps are soft: rename to `_deleted_<field>`; real drop only via retention job.
- Block heavy DDL while an incident is `active` unless the caller passes `force` with `admin:ddl-force`.
- Parameterise everything. Identifiers go through `quoteIdent`.
- Postgres 18 features welcome: `uuidv7()`, virtual generated columns, `RETURNING OLD/NEW`, `WITHOUT OVERLAPS` for bookings/rosters.

## Done when

Migration applies cleanly on a fresh DB and on a DB with sample data (Testcontainers test, `pnpm test:integration`), RLS denies a user without access, and an audit row is written.
