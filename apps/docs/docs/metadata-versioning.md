---
title: Metadata and versioning
---

:::warning Scaffold contract design
Draft/publish, rollback, migration planning and semantic versioning behavior are not implemented and require database integration tests.
:::

## Definition catalog

Tables, fields, relations, boards, views, workflows, positions, menus and themes are versioned definitions. Shared Zod schemas belong in `packages/schema/`; infrastructure must stay out of that package.

Each mutable definition needs:

- Stable tenant-owned identity independent of display name.
- A draft revision and, separately, the currently published version.
- Semantic version plus content integrity metadata.
- Dependency declarations by stable ID and compatible version range.
- Dependency integrity/digest policy for cached, imported and synced artifacts.
- Actor, position, incident where applicable, timestamp and request/audit IDs.
- Validation and authorization provenance for every publish.

## Draft to publish

1. Load the current authoritative revision under tenant authorization.
2. Apply edits to a draft; do not mutate the published definition in place.
3. Validate shared schemas, CEL, dependencies and permissions.
4. Preview a deterministic diff and, for table changes, a migration plan with destructive operations highlighted.
5. Publish by comparing the expected base revision in a transaction.
6. Append immutable version and audit records before notifying subscribers.
7. Derived artifacts and caches receive dependency references that prevent stale execution.

A publish is not complete merely because a JSON document validates. It also requires authorization, dependency compatibility, migration safety and an atomic catalog update.

## Optimistic record writes and sync

Every operational record carries `version`. A mutation supplies the version it read. The server applies the update only if that version still matches; stale writes return a conflict rather than silently overwriting.

Different-field edits may merge only when a defined, auditable merge rule permits it. Same-field conflicts expose base, local and server values and require an explicit choice. Offline replay uses the original base version and an idempotency key.

## Rollback and pack installs

Rollback creates a new published version based on a historical version; it does not erase history or audit. Physical data rollback may require a forward migration plan and can be blocked when incompatible data exists.

Starter files under `packs/` are non-importable placeholders with deliberately empty definition arrays. Before install, verify format/schema/export semantic versions, dependency resolution, declared capabilities, digests, tenant ownership and exact migration effects.

## Dependency policy

Runtime/library dependencies use the root pnpm catalog. Definition and pack dependencies use machine-readable semantic version ranges expressed in their own `@` manifest dialect; those are product metadata, not workspace dependency versions. Never substitute unbounded ranges such as `*` for production plugin or pack dependencies.
