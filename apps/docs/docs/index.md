---

id: index
slug: /
title: ArgusOS implementation scaffold
sidebar_label: Overview
---

:::danger Scaffold only
ArgusOS is not an operational crisis management product. These pages describe intended architecture, contracts and implementation order. Do not use this repository to manage a live incident.
:::

ArgusOS is planned as a self-hosted platform for a shared operating picture, versioned boards, real Postgres-backed tables, alerts, workflows and maps. Metadata drives runtime behavior; every change must preserve tenant, position and incident authorization, audit history and explicit conflict handling.

The authoritative requirements remain in the repository's `docs/PRODUCT_PLAN.md`. This site turns that plan into implementation guidance without silently turning plans into claims.

## Start here

1. [Architecture](./architecture.md) — package boundaries and planned runtime paths.
2. [Local development](./local-development.md) — prerequisites and the remaining bootstrap work.
3. [Metadata and versioning](./metadata-versioning.md) — draft/publish, rollbacks and optimistic writes.
4. [Security, RLS and audit](./security-and-audit.md) — non-negotiable trust boundaries.
5. [Realtime and events](./realtime-and-events.md) — the separate data-sync and domain-event pipelines.
6. [Roadmap](./roadmap.md) — vertical slices and their prerequisites.

## Implementation guides

- [Board runtime and builder](./board-implementation.md)
- [Field-type modules](./field-type-implementation.md)
- [Durable workflows](./workflow-implementation.md)
- [Sandboxed plugins](./plugin-implementation.md)
- [Deployment](./deployment.md)

## Status language

- **Contract** means a typed interface or schema boundary exists, but its behavior may still throw `TODO(implementation)`.
- **Planned** means no runtime behavior is implied.
- **Implemented** must be supported by meaningful tests and documentation of what was actually executed.
- A TODO-only test describes intended behavior; it is not a passing behavioral test.

Repository source paths appear as non-navigating inline code. Markdown links in this site are documentation links and should resolve to a valid generated route.
