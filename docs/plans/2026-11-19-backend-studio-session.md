# Backend slice: session + studio API (dev-mode builder end to end)

Status: done (2026-11-19) — typecheck, lint, format:check, test pass; API smoke-tested on PGlite. Follow-ups below. Owner: backend top-level thread. Parent plan:
[2026-11-19-dev-mode-studio.md](2026-11-19-dev-mode-studio.md) (`backend` row).

Goal: the web app's dev mode (board / page / component builder) and session context work end to
end against a real API. Contracts are fixed by the UI lead and are implemented, not changed:
`packages/schema/src/{studio,session,page,component,board,layout,versioning,audit,context}.ts`
and `apps/web/src/services/studio.ts` (`StudioPort`, `SessionPort`).

## Decisions

1. **Database without Docker: PGlite.** Docker is unavailable on the development host, so dev and
   tests use `@electric-sql/pglite` (real PostgreSQL compiled to WASM, in-process, no native
   binaries or install scripts). It supports schemas, roles, `SET ROLE`, forced RLS, triggers and
   `plpgsql`, so the RLS/audit design is exercised for real. Drizzle has first-class drivers for
   both PGlite and postgres.js, so the same schema/migrations/queries run on PostgreSQL 18 in
   deployment (`postgres` driver). PGlite 0.5.15 reports PostgreSQL 18.6 (checked at runtime);
   PostGIS is not available in PGlite and nothing in this slice uses it. `TODO(verify)`: run the
   same suites on server PostgreSQL 18 (postgres.js driver, real login roles) once Docker exists. Testcontainers PostgreSQL 18
   suites stay `it.todo` until Docker is available. `embedded-postgres` (native PG18) was rejected:
   only beta-tagged releases and platform binaries.
   - `DATABASE_URL=postgresql://…` → postgres.js (production/compose).
   - `DATABASE_URL=pglite:<dir>` → persistent PGlite (local dev only; refused in production).
   - `DATABASE_URL=pglite:memory` → ephemeral PGlite (tests).
2. **Auth: Better Auth email+password** (dev-friendly local auth), Drizzle adapter, tables in the
   `auth` schema. Better Auth identities map to ArgusOS users through `meta.users.auth_user_id`;
   tenant and position membership are server-side mappings only. OIDC stays a stub.
3. **Tenant isolation in the database.** Every tenant-owned table has `ENABLE` + `FORCE ROW LEVEL
   SECURITY` with policies on `current_setting('argus.tenant_id', true)`. Each request runs in a
   transaction that does `SET LOCAL ROLE argus_app` and sets `argus.tenant_id`, `argus.user_id`,
   `argus.position_id`, `argus.request_id` with `set_config(…, true)` from the authenticated
   context. Services also filter by tenant (defence in depth). Pre-tenant identity resolution uses a
   narrow `SECURITY DEFINER` function, not an RLS bypass.
4. **Audit is append-only**: `audit.definition_changes` (matches `auditDefinitionChangeSchema`) and
   `audit.session_events` (position/incident selection). `argus_app` has `INSERT, SELECT` only and a
   trigger rejects `UPDATE`/`DELETE` for every role. Audit rows are written in the same transaction
   as the change.
5. **Versioning model.** `meta.studio_definitions` holds one row per definition (kind, key, name,
   slug, pointers to the current draft/published version, archived state, row version).
   `meta.studio_definition_versions` holds `(definition_id, version)` rows; versions only grow.
   - `create` → version 1, lifecycle `draft`.
   - `saveDraft(baseVersion)`: if a draft exists, `baseVersion` must equal it and the draft row is
     replaced as version `max + 1` (conditional update, so concurrent savers conflict); if no draft
     exists, `baseVersion` must equal the published version and a new draft `max + 1` is created.
     Mismatch → `definition-version-conflict`. Schema-valid drafts are accepted even with reference
     errors (work in progress).
   - `publish(expectedVersion)`: the draft must be exactly `expectedVersion` and have zero
     error-severity issues from `validate`; the draft row becomes an immutable published version.
   - `rollback(expectedPublishedVersion, restoreVersion)`: copies a previously published version to
     a new published version `max + 1`; history is never rewritten; an existing draft is kept.
   - `archive(expectedVersion)`: `expectedVersion` is the latest version (draft if any, else
     published); hides the definition from runtime reads and `list`; history kept.
   - Server-owned document metadata (`id`, `tenantId`, `version`, `lifecycle`, `createdAt/By`,
     `createdPositionId`, `publishedAt/By`, `changeSummary`, board layout `boardId`) is overwritten
     by the server on write and on read; client values are ignored.
6. **Idempotency.** `meta.idempotency_keys (tenant_id, user_id, key)` unique, storing operation,
   SHA-256 of the canonical input and the response, written in the mutation's transaction. Replay
   with the same input returns the stored response (no second audit event); reuse with a different
   input → `validation-failed` ("idempotency key reused"). `saveDraft` has no key in the contract;
   its `baseVersion` makes retries safe.
7. **Permissions.** `StudioPermissions` are columns of `meta.positions`. Rules:
   - `list`/`get(published)`/`getPageBySlug`: any authenticated position; non-studio callers see
     only published, non-archived definitions whose `access.positionIds` is empty or contains their
     position. `TODO(decision)`: empty `positionIds` = no extra restriction (assumed here);
     `visibilityRule` CEL is not evaluated until @argus/expr lands (documented, not silently passed:
     a definition with a non-null rule is hidden from non-studio callers).
   - `get(draft|number)`, `listVersions`, `validate`: `viewStudio`.
   - `create`/`saveDraft`/`archive`: `editDefinitions`; for `component` additionally `editCode`.
   - `publish`/`rollback`: `publishDefinitions` (component: also `editCode`).
   - Item permissions = position permissions with the rules above applied per kind.
   - Inaccessible or other-tenant ids → `not-found` (never `forbidden`, no existence leak).
8. **Validation (`validate`, also run by `publish`).** Schema (Zod issues mapped to
   `DefinitionIssue` paths), board bundle cross-references (`layout.boardId`, `definition.layoutId`,
   unique block ids, layout items → existing blocks, one layout per breakpoint), page refs (via the
   page schema refinement), `board-embed` → existing published board, `custom-component` config
   parses with `customComponentBlockConfigSchema` and pins an existing **published** component
   version, page `homepageForPositionIds` exist in the tenant and are not claimed by another
   published page, component prop keys unique and `options` only for `enum`. CEL: `parseCel` from
   @argus/expr is a stub today, so `validate` emits one `warning` at path `[]` ("CEL expressions
   were not checked") when the document contains CEL; it switches to real parse issues once
   `parseCel` is implemented (no code change in callers).
9. **Templates.** `blank` page/component → valid starter documents. `blank` board → rejected
   (`validation-failed`): `boardDefinitionSchema` requires ≥1 data source and ≥1 view, which a
   blank board cannot satisfy — reported to the UI lead as a contract issue. `from-table` →
   `TODO(implementation)` error until the table catalog slice exists. `eject-block` → component
   whose source is a clearly labelled starter for the block type, `ejectedFrom` set. `duplicate` →
   copy of the source's published version (`not-found` if none).
10. **Custom component source is stored only** — never compiled, evaluated or executed on the
    server; size bounded by `CUSTOM_COMPONENT_SOURCE_MAX_LENGTH` and Fastify `bodyLimit`.
11. **Errors.** `TRPCError`s carry an `ApiError` (`@argus/schema` `apiErrorSchema`) in
    `error.data.apiError` via the error formatter, so clients switch on `code`
    (`definition-version-conflict`, `not-found`, …). Messages never include SQL or other tenants' data.
12. **Web adapter without new web dependencies.** `apps/web/src/services/api/**` implements a small
    fetch-based tRPC v11 HTTP client (no transformer, `credentials: "include"`) typed against the
    shared `StudioApi`/`SessionPort` contracts, so `apps/web/package.json` (not owned by this thread)
    does not change. A server-side type test asserts the `AppRouter` procedure inputs/outputs equal
    the `StudioApi` contract, so drift fails `pnpm typecheck`.
13. **Dependency versions** (all released ≥ 2 weeks before 2026-11-19): `@electric-sql/pglite`
    0.5.15, `postgres` 3.4.9 (4.0.0 is a new major, deferred), `drizzle-kit` 0.31.11,
    `@fastify/cors` 11.4.0, `@fastify/helmet` 13.2.0. `@trpc/server` is moved **back** from 11.29.4
    (published 2026-11-18, below the age policy) to 11.24.0 and its release-age exclusion removed.

## Layout (apps/api/src)

```
config/env.ts            parseApiEnvironment (zod), secret refs (`env:NAME` resolver)
db/client.ts             createDatabase(url) → { db, close, driver }   (pglite | postgres.js)
db/migrate.ts            runMigrations(database)  (drizzle migrator over apps/api/migrations)
db/transaction.ts        withTenantTransaction(database, ctx, fn)  (SET LOCAL ROLE + claims)
persistence/system-schema.ts  Drizzle tables (meta/audit/auth schemas)
errors.ts                apiError(code, message, …) → TRPCError; error formatter
auth/better-auth.ts      createBetterAuth(...), BetterAuthPort adapter
http/request-context.ts  resolveRequestContext (session cookie → RequestContext, positionId non-null)
trpc/init.ts             initTRPC, context type, authedProcedure, studioProcedure helpers
session/service.ts       SessionService: get / selectPosition / selectIncident
session/router.ts        `session` tRPC router
studio/service.ts        StudioService implementing StudioApi per OperationContext
studio/validation.ts     validateStudioDocument(...)
studio/templates.ts      starter documents for create templates
studio/router.ts         `studio` tRPC router
trpc/router.ts           createAppRouter → { session, studio }; `AppRouter` type
composition.ts           createApiServer / startApi (Fastify, cors, helmet, Better Auth routes,
                         /trpc, /health/live, /health/ready, graceful shutdown)
scripts/seed-dev.ts      explicit fictional dev seed (refuses outside development)
```

## Tasks

| id | agent | owns | depends on | skills | status |
|----|-------|------|-----------|--------|--------|
| b0-foundation | implementer (sonnet) | catalog/lockfile, `apps/api/package.json`, `config/`, `db/`, `persistence/`, `errors.ts`, `trpc/init.ts`, `migrations/`, test harness, stub files for b1/b2 | — | argus-ddl-migration, argus-testing | done |
| b1-auth-session | implementer (sonnet) | `auth/`, `http/`, `session/`, `composition.ts`, `main.ts`, `trpc/router.ts`, `scripts/`, `.env.example` | b0 | argus-testing | done |
| b2-studio | implementer (sonnet) | `studio/**` | b0 | argus-ddl-migration, argus-testing | done |
| b3-web-adapter | implementer (sonnet) | `apps/web/src/services/api/**` | b1, b2 | argus-testing | done |
| b4-docs | docs-writer (sonnet) | `apps/api/README.md`, `docs/development/api-local.md` | b1, b2 | — | done |
| b5-review | reviewer (sonnet) | read-only: authz, tenant isolation, audit, idempotency | b3 | — | done |
| b6-verify | orchestrator | workspace checks, plan rows | b5 | — | done |

## Backlog items handled here (scaffold-integration.md)

- #2 `UpdateCatalogEntity` patching scoping/tombstone columns → per-entity patch types.
- #3 nullable `positionId` in API context → non-null in `RequestContext`/`RepositoryScope`.
- #9 web-built `AuditMetadata`: studio/session audit is fully server-derived; the remaining
  web `AuditMetadata` type lives in UI-owned files and is reported, not edited.

## Not in this slice

REST `/api/v1` handlers, OpenAPI, records/tables/DDL, ElectricSQL shapes, NATS outbox, worker jobs,
OIDC, MFA, Testcontainers PG18 runs, Docker/Helm changes.

## Review outcome (b5) and follow-ups

Fixed after review: `studio.validate` is a POST mutation (documents never travel in URLs; request
logs drop query strings); page publish/rollback take a per-tenant `pg_advisory_xact_lock` before
checking homepage claims and rollback re-runs reference validation; `archive` of a board/component
with published dependents → `dependency-conflict` (`details.dependents`); `NODE_ENV` is required
(fail closed); invalid list cursors → `validation-failed`; audit rows carry the incoming
`x-correlation-id`; web error mapping for non-tRPC 403/401/429 and stricter API base URL.

Open follow-ups (not done, need a decision or real PostgreSQL):

1. Production roles: runtime login must be a non-owner `NOBYPASSRLS` member of `argus_app`, with
   migrations/identity on a separate role and Better Auth on its own pool. Untested — PGlite runs
   as superuser.
2. Sign-in/sign-out are not audited (`audit.session_events` `sign-in` op unused); add a Better Auth
   hook. Audit actor/definition columns lack composite FKs.
3. `TODO(decision)`: any tenant position may select any non-archived incident (no incident ↔
   position assignment yet).
4. Published custom component source is readable by every authenticated position (needed by the
   runtime sandbox) — confirm intended.
5. No rate limit on `/trpc`; Better Auth rate limiting is in-memory per instance.
6. Concurrency tests run on single-connection PGlite; re-run on PostgreSQL 18 (Testcontainers todo).
7. Contract issues for the UI lead: blank board is unsatisfiable (`boardDefinitionSchema`
   `dataSources`/`views` `.min(1)`); `jsonValueSchema` should be `z.ZodType<JsonValue, JsonValue>`
   (router uses a narrowing cast until then); no `not-implemented` `ApiErrorCode` (from-table uses
   `unavailable`); `StudioDefinitionSummary` lacks `blockCount` (boards adapter does N+1 fetches).
