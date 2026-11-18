<img src="assets/icon.svg" width="64" height="64" alt="">

# ArgusOS

ArgusOS is planned as a self-hosted crisis and incident management platform: live operational tables, a no-code board builder, mapping, alerts, workflows and position-based homepages.

> **Repository status: implementation scaffold.** This checkout establishes the monorepo, deployment topology, shared contracts and documented stubs. It is not an operational incident management system. Search for `TODO(implementation)` before assuming any behavior exists.

The complete product brief is in [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md). Start implementation with [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md); see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/STACK.md](docs/STACK.md) for fixed boundaries and dependency policy.

## Stack

- Node.js 26 LTS, strict ESM TypeScript, pnpm catalogs, Turborepo
- React 19, Vite 8, TanStack Router/Query, Tailwind CSS 4, Radix and Storybook
- Fastify, tRPC and versioned REST/OpenAPI 3.1
- PostgreSQL 18/PostGIS, Drizzle system tables and a separate user-table DDL planner
- ElectricSQL row sync, NATS JetStream domain events and a WebSocket presence/alert gateway
- Graphile Worker, S3-compatible storage, MapLibre and Martin
- Biome, Vitest, Playwright, Testcontainers and k6
- Docker Compose for local/small deployments and Helm for Kubernetes

## Prerequisites

- Node.js 26 and pnpm 12 (the root `packageManager` field pins pnpm)
- Docker with Compose for infrastructure and integration tests
- Kubernetes tooling (`helm`, and optionally `kubectl`) for chart validation

## Bootstrap

```sh
npm install --global pnpm@12.21.0
pnpm install
cp .env.example .env
docker compose --env-file deploy/compose/.env.example -f deploy/compose/docker-compose.yaml up -d --wait
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

On Windows, use `Copy-Item .env.example .env` instead of `cp`. The Compose file supplies **local-only defaults**; rotate every credential before any shared or production deployment.

See [deploy/README.md](deploy/README.md) for the actual Compose path, profiles and limitations. No database migration or application behavior should be assumed just because a container is healthy.

## Workspace map

```text
apps/
  web/        Operations SPA and no-code builders
  api/        Fastify, tRPC and public REST boundary
  realtime/   WebSocket presence and alert gateway
  worker/     Durable workflows, alerts, imports and feeds
  mobile/     Expo responder application shell
  docs/       Documentation site
packages/
  schema/     Shared Zod metadata and event contracts
  ddl-engine/ Safe physical table migration planning ports
  field-types/ Field type plugin registry and modules
  blocks/     Board block registry and renderer ports
  expr/       CEL parser/evaluator/SQL compiler ports
  ui/         Design tokens and accessible component contracts
  sdk/        Sandboxed client/server plugin contracts
  alerts/     Notification channel adapter contracts
  maps/       MapLibre, layers and drawing contracts
packs/        Non-importable starter pack placeholders
deploy/       Compose and Helm infrastructure
tests/        Cross-workspace E2E, integration and load contracts
```

## Working on the scaffold

Every stub documents its responsibility and integration seams. Use `TODO(implementation)` for missing behavior, `TODO(decision)` for product decisions and `TODO(verify)` for assumptions requiring validation. Tests use todo/skip markers until they assert real behavior; an empty or todo-only suite is not evidence that a feature works.

Implementation order and security invariants are in [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md). Project conventions are in [AGENTS.md](AGENTS.md). To run the session and studio API locally without Docker, see [docs/development/api-local.md](docs/development/api-local.md).

## Open decisions

The open-source license, hosted support model, final branding/trademark checks and some scale/deployment choices remain unresolved. No license is granted by this scaffold until a root `LICENSE` is deliberately added.
