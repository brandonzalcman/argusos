# @argus/api

Fastify composition root for the internal tRPC API (`/trpc`) and Better Auth (`/api/auth/*`). Audience: contributors.

To run it locally without Docker, see [docs/development/api-local.md](../../docs/development/api-local.md). Design decisions for this slice are in [docs/plans/2026-11-19-backend-studio-session.md](../../docs/plans/2026-11-19-backend-studio-session.md).

## Status

Implemented (the "session + studio" slice):

- `session` tRPC router: `get` (public, null when anonymous), `selectPosition`, `selectIncident`.
- `studio` tRPC router: `list`, `get`, `getPageBySlug`, `listVersions`, `validate`, `create`, `saveDraft`, `publish`, `rollback`, `archive`, with optimistic version checks and idempotency keys.
- Better Auth email and password at `/api/auth/*` (public sign-up disabled).
- Drizzle system schema and reviewed SQL migrations with forced row-level security and append-only audit tables.
- `/health/live` and `/health/ready`.

Still stubs (`TODO(implementation)`): REST `/api/v1` handlers and OpenAPI (`src/rest/`), records and user tables, OIDC, MFA, API keys, ElectricSQL shapes, NATS outbox. CEL expressions are not parsed yet, so `studio.validate` returns a warning when a document contains CEL. Migration details are in `migrations/README.md`.

## Source layout (`src/`)

| Path | Purpose |
| --- | --- |
| `main.ts`, `composition.ts` | Entry point; Fastify composition, CORS, helmet, health probes, shutdown |
| `config/env.ts` | Environment validation and `env:NAME` secret references |
| `db/` | Database client (postgres.js or PGlite), migrator, tenant transactions |
| `persistence/` | Drizzle system schema and repositories |
| `auth/` | Better Auth instance and ports |
| `http/request-context.ts` | Session cookie to request context |
| `trpc/` | tRPC init, procedures, `AppRouter` |
| `session/`, `studio/` | Domain services and routers |
| `rest/` | REST and OpenAPI contracts (stubs) |
| `scripts/` | `migrate.ts`, `seed-dev.ts` |
| `errors.ts` | `ApiError` carried in `error.data.apiError` |

Tests are in `test/`.

## Scripts

Run as `pnpm --filter @argus/api <script>`.

| Script | What it does |
| --- | --- |
| `dev:local` | Start the API with `tsx watch`, loading the repo-root `.env` if present |
| `start` | Run the built `dist/main.js` |
| `build` / `dev` | `tsc` build / watch |
| `typecheck` | Strict type check |
| `test` | Vitest (in-memory PGlite) |
| `db:generate` | Generate SQL from the Drizzle schema |
| `db:migrate` | Apply migrations to `DATABASE_URL` |
| `db:seed` | Fictional dev seed (needs `ARGUS_ALLOW_DEV_SEED=true`) |

## Security notes

- Tenant, user and position come only from the verified Better Auth session and server-side mappings, never from headers or bodies.
- Each request runs in a transaction with `SET LOCAL ROLE argus_app` and transaction-local claims; every tenant-owned table has forced RLS.
- Audit tables are append-only (a trigger rejects UPDATE, DELETE and TRUNCATE for every role).
- Custom component source is stored only. It is never compiled or executed on the server.
- Browser `Origin` headers on `/trpc` must be on the `PUBLIC_WEB_ORIGIN` allowlist.
- Inaccessible and other-tenant ids return `not-found`, not `forbidden`.
