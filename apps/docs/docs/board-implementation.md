---
title: Board implementation guide
---

:::warning Scaffold guide
No-code board editing, publishing and runtime rendering are future implementation work. The Expo board route currently renders a labeled placeholder only.
:::

## Definition boundary

A board is versioned JSON interpreted at runtime, never code-generated. Its contract lives in `packages/schema/` and refers to table/view/block definitions by stable IDs. Mobile and web must consume the same `BoardDefinition` and inferred input/output types.

A complete definition needs data sources, named views, responsive 12-column layouts, ordered blocks, dependencies and position/field permissions. Validate every reference and semver dependency at publish time; rendering must not recover from malformed authorization metadata by guessing.

## Runtime sequence

1. Authorize tenant, position, incident, board and requested view.
2. Resolve exactly one published board version and compatible field/table versions.
3. Build an authorized field projection: hidden fields are omitted, not merely CSS-hidden.
4. Compile supported CEL through `packages/expr/` with parameterized SQL.
5. Query through scoped APIs/RLS and render with `packages/blocks/` and `packages/ui/`.
6. Keep the active definition and record versions attached to mutations.
7. Display committed updates, pending offline changes and conflicts distinctly.

## Builder sequence

Implement single-author draft editing before collaborative Yjs editing. Add property validation, responsive layout and preview-as-position with test fixtures. Publish only after dependency validation and visual/schema diff approval. Version restore creates a new draft/publish operation and never deletes history.

Start with list, detail and input-form views plus a small set of safe field/display blocks. Kanban, map, timeline, charts, embeds and sandboxed plugins follow after their security and data contracts are proven.

## Mobile implementation

The typed boundary is `prepareBoardForm()` in `apps/mobile/`. It must run after server authorization; the current route parameter is deliberately unvalidated. Native capabilities may write only to a local incident-scoped draft until an authorized, version-checked mutation is accepted.

## Tests to add

- Round-trip shared definition schema and reject unknown unsafe blocks.
- Verify hidden/read-only fields across API, export, search and all views.
- Check tenant, incident and exercise isolation in cache and subscriptions.
- Exercise optimistic conflicts and rollback of definition references.
- Test keyboard/screen-reader behavior and responsive rendering without fake operational data.
