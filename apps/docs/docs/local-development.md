---
title: Local development
---

:::danger Scaffold checks only
The integration checkout has workspace dependencies installed through pnpm 12.21.0. Dependency installation and tooling checks do not verify product behavior, external services, migrations or deployment workflows.
:::

## Prerequisites

- Node.js 26 LTS and pnpm 12, matching the root engines.
- A TypeScript-aware editor using the workspace TypeScript version.
- Docker with Compose only when local integration infrastructure is needed and available.
- PostgreSQL 18 + PostGIS, NATS JetStream and S3-compatible storage for later integration slices.

No credentials belong in source or committed `.env` files. Until real secret handling and bootstrap scripts exist, use explicit local-only placeholders and never production data.

## Workspace checks

From the repository root, with dependencies installed:

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

`build` runs package/application builds through Turbo. Library outputs use `dist/` JavaScript and declarations; the docs site uses `dist/` static output. `test` may contain only TODO tests during scaffolding, so its result is not evidence of operational behavior.

Focused scaffold commands:

```sh
pnpm --filter @argus/mobile build
pnpm --filter @argus/mobile typecheck
pnpm --filter @argus/docs build
pnpm --filter @argus/docs typecheck
pnpm --filter @argus/docs test
pnpm --filter @argus/docs dev
```

Expo's development server and Docusaurus development server are tooling entry points only. Starting either does not authenticate a user, connect a backend or enable native capabilities.

## Compose infrastructure scaffold

The Compose file is `deploy/compose/docker-compose.yaml`, with local-only example variables in `deploy/compose/.env.example`. Copy the example to an uncommitted local environment file before starting dependencies:

```sh
cp deploy/compose/.env.example .env.development
docker compose --env-file .env.development -f deploy/compose/docker-compose.yaml up -d --wait
```

On Windows, use `Copy-Item deploy/compose/.env.example .env.development` instead of `cp`. Applications intentionally run as host processes rather than Compose services in this scaffold. These are reserved local ports, not claims that endpoints are running:

| Purpose          | Loopback port | Current scaffold ownership          |
| ---------------- | ------------- | ----------------------------------- |
| Web application  | `3000`        | Host process; not a Compose service |
| API              | `3001`        | Host process; not a Compose service |
| Realtime gateway | `3002`        | Host process; not a Compose service |
| ElectricSQL      | `3003`        | Compose dependency endpoint         |
| Martin           | `3004`        | Compose dependency endpoint         |

The Compose file also declares loopback dependency ports for PostgreSQL and NATS. See `deploy/README.md` for its current service inventory and provider-specific configuration; this guide refers to object storage only as S3-compatible storage. Starting containers does not run migrations, establish authorization or prove external-service compatibility.

## First vertical slice

1. Preserve the centralized dependency catalog and generated lockfile through root-owned configuration.
2. Establish Node/TypeScript/Biome/Turbo builds with meaningful contract tests.
3. Add PostgreSQL/testcontainer integration and migrations for tenants, users, positions and incidents.
4. Establish OIDC/local development identity and server-side session scope.
5. Prove RLS and audit with adversarial cross-tenant and cross-incident tests.
6. Implement one small system-catalog read/write API before introducing user-table DDL or sync.

Do not mark local Docker, database, realtime, native-device or end-to-end workflows as tested unless they actually ran. Integration and E2E scripts are separate from unit TODO suites.

## Source map

Root configuration is intentionally centralized. App/package agents must not add numeric versions to workspace manifests, edit root catalogs, mutate git state or reach into another ownership area. Report missing shared contracts instead of forking them locally.

See [Architecture](./architecture.md) for the contract index and [Roadmap](./roadmap.md) for delivery order.
