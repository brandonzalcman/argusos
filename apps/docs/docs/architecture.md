---
title: Architecture
---

:::warning Not implemented
This is the target package and data-flow design. External services, generated APIs and runtime integrations are not connected by the documentation scaffold.
:::

## System boundaries

PostgreSQL is the source of truth. The `meta` catalog stores definitions and versions; real typed user tables live in tenant-controlled data schemas. Drizzle is for system tables, while the DDL engine plans physical user-table changes.

| Boundary                                  | Ownership           | Intended responsibility                                           |
| ----------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `apps/web`                                | Operations web app  | Boards, grids, table designer, builders and map UI                |
| `apps/api`                                | Application backend | Authz, catalog, tRPC, versioned REST and generated table APIs     |
| `apps/realtime`                           | WebSocket gateway   | Authenticated presence and alert fan-out                          |
| `apps/worker`                             | Durable jobs        | Workflow, alert, feed and import/export entry points              |
| `apps/mobile`                             | Expo shell          | Responder routes and typed capability contracts                   |
| `packages/schema`                         | Shared definitions  | Zod definitions and inferred safe-IO types, no infrastructure     |
| `packages/ddl-engine`                     | Migration planning  | Injection-safe diffs and migration plans                          |
| `packages/expr`                           | CEL ports           | Parse, evaluate and compile expressions without SQL interpolation |
| `packages/blocks`, `packages/field-types` | Registries          | Typed board-block and field-type contracts                        |
| `packages/maps`, `packages/ui`            | Presentation        | Map abstractions and shared design system                         |
| `packages/alerts`, `packages/sdk`         | Extensibility       | Channel adapters and sandboxed plugin protocol                    |

This table is the scaffold contract index. Paths identify repository ownership, not deployed documentation routes, and the presence of a typed contract does not imply working behavior.

## Planned write path

1. The client submits an operation inside tenant, user, position and incident scope.
2. The API authenticates the session and authorizes the operation.
3. Database session variables and row-level security independently enforce row access.
4. The write checks the expected optimistic `version` and commits in a transaction.
5. Append-only audit captures actor, position, incident, field diff, timestamp and request ID.
6. Sync publishes the committed row change in WAL order; domain events use NATS JetStream.
7. Clients update only subscriptions they are authorized to read.

No uncommitted change may become visible as a committed operational update. Client-supplied scope is never sufficient authorization.

## React Native and runtime separation

All workspace packages and applications use strict ESM TypeScript. Web/server library builds expose ESM JavaScript and declarations from `dist/` using explicit `.js` relative import specifiers where Node resolution applies. Native/mobile code follows Expo's bundler but retains typed, runtime-neutral shared contracts. Docusaurus builds its static site into its own `dist/`.

The documentation tooling has a temporary package-boundary exception: `apps/docs/package.json` leaves `type` unset for Docusaurus 3.10.2 SSG compatibility while its TypeScript remains ESM. `TODO(verify)`: retest and restore `"type": "module"` after upstream Docusaurus support is confirmed.

## Implementation order

Start with identity, tenants, positions and incidents; then system catalog persistence and RLS; then table planning; then field and board contracts; then read/write APIs and sync. Workflows, alerts, maps, packs, mobile and plugins depend on those foundations.
