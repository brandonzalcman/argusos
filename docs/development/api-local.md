# Running the API locally (no Docker)

Audience: contributors. This runs `@argus/api` (session and studio tRPC routers plus Better Auth) on an embedded PostgreSQL (PGlite), with no Docker.

## Prerequisites

- Node.js 26 and pnpm 12 (see `engines` in the root `package.json`).
- On hosts without pnpm 12, use `npm.cmd exec --cache .npm-cache --yes --package=pnpm@12.21.0 -- pnpm` wherever this page says `pnpm`. Plain `pnpm` works where pnpm 12 is installed.
- `pnpm install` has been run at the repo root.

## Why PGlite

Docker is not available on every development host. PGlite is real PostgreSQL compiled to WASM, running in-process. It supports schemas, roles, `SET ROLE`, forced RLS and triggers, so the RLS and audit design is exercised for real. The same migrations run on PostgreSQL 18 in deployment. Rationale: decision 1 in the [backend plan](../plans/2026-11-19-backend-studio-session.md). PGlite has no PostGIS and is refused in production.

## Environment

Copy `.env.example` to `.env` at the repo root. `dev:local` and `db:seed` load it if present; variables already set in your shell are not overridden. Set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `pglite:./.argus-data/pglite`. A relative path resolves against the process working directory, which is `apps/api` under `pnpm --filter`. |
| `BETTER_AUTH_SECRET` | Any string you choose; use 32 or more characters (enforced in production). |
| `ARGUS_ALLOW_DEV_SEED` | `true` (the example file has `false`) |
| `ARGUS_DEV_SEED_PASSWORD` | 12 or more characters. Set it locally; never commit it. |
| `PUBLIC_WEB_ORIGIN` | `http://localhost:3000` (comma-separated list allowed). Allowlist for CORS, Better Auth and `/trpc`. |

`NODE_ENV` must be `development` for the seed. `API_PORT` defaults to 3001 and `API_HOST` to 127.0.0.1 in development. The NATS, S3 and OIDC variables in `.env.example` are not used by this slice.

## Seed

Stop the API first: PGlite is single-process, so two processes cannot share one data directory.

```sh
pnpm --filter @argus/api db:seed
```

The seed migrates the PGlite directory, then creates a fictional tenant (`fictional_county`), three positions, one exercise incident and three users. It is idempotent. It refuses unless `NODE_ENV=development`, `ARGUS_ALLOW_DEV_SEED=true` and the password is set.

## Start

```sh
pnpm --filter @argus/api dev:local
```

The API listens on http://127.0.0.1:3001. PGlite databases are migrated automatically at start.

## Smoke test

```sh
curl -s http://127.0.0.1:3001/health/live
curl -s http://127.0.0.1:3001/health/ready

# Sign in; the Origin header must be allowlisted. Replace the password.
curl -s -c jar.txt -X POST http://127.0.0.1:3001/api/auth/sign-in/email \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"email":"builder@example.invalid","password":"<ARGUS_DEV_SEED_PASSWORD>"}'

# Session snapshot (null when anonymous)
curl -s -b jar.txt -H "Origin: http://localhost:3000" http://127.0.0.1:3001/trpc/session.get

# Studio list; the input is URL-encoded JSON
curl -s -b jar.txt -H "Origin: http://localhost:3000" -G http://127.0.0.1:3001/trpc/studio.list \
  --data-urlencode 'input={"kind":"page","search":null,"cursor":null,"limit":20}'
```

On a fresh seed the list is empty: the seed creates no studio definitions.

## Seed accounts

All accounts are fictional and share `ARGUS_DEV_SEED_PASSWORD`.

| Email | Positions | May |
| --- | --- | --- |
| `builder@example.invalid` | `studio_builder`, `studio_viewer` | View, edit and publish studio definitions and edit component code. The first position by key (`studio_builder`) is selected on first sign-in. |
| `viewer@example.invalid` | `studio_viewer` | View studio definitions (drafts, versions, validate). Cannot edit or publish. |
| `responder@example.invalid` | `field_responder` | No studio permissions. Sees only published, non-archived definitions its position may access. |

## Pointing the web app at it

The web app reads `VITE_ARGUS_API_URL` (default `http://localhost:3001`). Keep `PUBLIC_WEB_ORIGIN` equal to the web app's origin. The wiring itself is owned by the UI work and is not described here.

## Using real PostgreSQL instead

Set `DATABASE_URL` to a `postgresql://` URL. The API never migrates a PostgreSQL database implicitly; run it explicitly:

```sh
pnpm --filter @argus/api db:migrate
```

Role requirements (see `apps/api/migrations/README.md`):

- The login role used at runtime must be a member of `argus_app` (the API runs `SET ROLE argus_app` per request).
- The role used for migrations, the seed and identity bootstrap must be a superuser or have `BYPASSRLS`, and must be able to grant `argus_identity` to itself.

The API, `db:migrate` and `db:seed` all read `DATABASE_URL`; `MIGRATION_DATABASE_URL` in `.env.example` is not read by this package. This path has not been verified against a real PostgreSQL 18 server.

## Tests

```sh
pnpm --filter @argus/api test
```

Everything runs on in-memory PGlite (`pglite:memory`). The PostgreSQL 18 Testcontainers suites are `todo` because Docker is unavailable.

## Troubleshooting

- **403 `origin-not-allowed` from `/trpc`**: the request's `Origin` header is not in `PUBLIC_WEB_ORIGIN` (or the API's own origin). Requests without an `Origin` header are accepted.
- **Sign-up fails**: public sign-up is disabled by design. Accounts are created only by the dev seed.
- **PGlite hangs or errors on open**: two processes are using the same data directory. Stop the API before seeding, or point each process at a different directory. Delete `apps/api/.argus-data` to reset.
- **Seed refused**: check `NODE_ENV=development`, `ARGUS_ALLOW_DEV_SEED=true` and a password of 12 or more characters.
- **`DATABASE_URL` invalid**: the value must be `postgresql://`, `pglite:<dir>` or `pglite:memory`.
