---
title: Roadmap and implementation order
---

:::warning Planning status
Phase labels communicate dependency order, not completion. The current repository is an implementation scaffold.
:::

## Phase 0 — foundations

Monorepo builds, public contracts, CI, tenants, users, positions, incidents, OIDC/local identity and design-system foundations. Exit when cross-tenant/incident authorization and strict builds are verified by real tests.

## Phase 1 — tables and audit

System catalog, RLS, append-only audit, migration planning, initial field types, real user tables and one grid mutation path. Add sync only after committed writes and access policies are correct. Exit with database integration tests for migrations, conflict behavior and tenant isolation.

## Phase 2 — boards

Shared board schemas, responsive layout, initial blocks, list/detail/form views, CEL policy, draft/publish and preview-as-position. Exit with one usable authorized table-to-board vertical slice.

## Phase 3 — realtime and homepages

Presence, visible connection state, reconnect/replay, position homepages, menus and command entry. Measure the product plan's realtime targets before reporting them as achieved.

## Phase 4 — workflows and alerts

Durable workflow steps/run logs, alert channel adapters, acknowledgement and escalation. Test idempotency, channel failure, retries, permissions and audit before enabling external side effects.

## Phase 5 — maps

PostGIS location types, Martin/MapLibre wrappers, map views/blocks and external layers with field-level filtering and bounded load.

## Phase 6 — packs and v1 readiness

Implement validated/signed pack import/export and dependency/migration previews. Replace the nine empty placeholders under `packs/` only after each operational board has its own tested vertical slice. Complete deployment upgrades, restore drills, documentation and security review.

## After v1

Full mobile responder behavior, public forms, production plugin tooling, registry, cross-agency sharing and optional local/provider-agnostic AI. The current mobile scaffold in `apps/mobile/` establishes typed routes and contracts in advance but deliberately implements none of these capabilities.

## Change discipline

Land one vertical slice at a time. Preserve public contracts or deliberately version them. Update documentation with implemented behavior and actual checks. Keep behavior gaps as searchable `TODO(implementation)` throwing stubs and intended tests as `it.todo`/`describe.todo`.
