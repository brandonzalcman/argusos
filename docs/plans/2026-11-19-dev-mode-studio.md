# Dev mode (studio): board, page and component builder + page polish

Status: wave 0 done (contracts). Waves 1–3 pending.

## Decisions (confirmed with the user, 2026-11-19)

1. **Code depth: definition + custom components.** Every board, page and block has a *Code* view
   of its JSON definition (and CEL expressions), in two-way sync with the visual builder. Users
   with `editCode` can write **custom components** (TSX) in the browser, and can **eject** any
   built-in block into an editable custom component. Users never access the repository.
2. **Backend: a separate top-level thread builds the API** against the contracts below (no
   browser-local workspace). Until it lands, the opt-in demo mode (`pnpm --filter @argus/web
   dev:demo`, fictional data, permanent banner) exercises the UI.
3. **Pages are composable definitions** (slug, title, 12-column block layout incl. embedded
   boards, links, KPIs, custom components), shown in menus and assignable as position homepages.
   Boards stay data-centric (sources + views).

## Architecture

- **Studio** = dev mode. A top-bar "Dev mode" toggle appears only when
  `SessionSnapshot.studio.viewStudio` is true. With dev mode on, every runtime board/page shows an
  "Edit" affordance and the shell shows a distinct dev-mode strip. `/studio` lists Boards, Pages
  and Components.
- **One builder for boards and pages.** Three panes (palette, live canvas, inspector) plus a
  toolbar switch: **Design | Code | Preview**. Code = the whole document as JSON in a CodeMirror
  editor, validated with the shared Zod schemas (issues → inline diagnostics); valid edits replace
  the draft (one undo step); invalid text never touches the draft. The inspector has a per-block
  *Code* tab (the block's JSON) and, for built-in blocks, **Customize code (eject)**. Preview has
  "Preview as position".
- **Custom components** (`/studio/components/$id`): TSX editor, props editor (no-code controls
  generated from `ComponentProp`), capability editor, live preview, console/errors, publish.
- **Sandbox (security boundary).** Source is compiled and run **only inside a sandboxed iframe**
  (`sandbox="allow-scripts"`, opaque origin, strict CSP, no network except the host bridge). The
  host never `eval`s user code. Data crosses only through the @argus/sdk message bridge, limited
  to approved capabilities, with hidden fields removed by the host. Runtime blocks pin an exact
  published component version.
- **Persistence/audit:** every definition uses the generic studio lifecycle — draft → publish →
  rollback/archive — with optimistic versions, idempotency keys and audit events.

## Contracts (wave 0 — done; parallel tasks must not change them)

- `packages/schema/src/page.ts` — `pageDefinitionSchema`, `pageSlugSchema`.
- `packages/schema/src/component.ts` — `customComponentDefinitionSchema`, `componentPropSchema`,
  `customComponentBlockConfigSchema`, `CUSTOM_COMPONENT_SOURCE_MAX_LENGTH`.
- `packages/schema/src/session.ts` — `sessionSnapshotSchema`, `studioPermissionsSchema`,
  select position/incident inputs.
- `packages/schema/src/studio.ts` — generic `studio` router contract (`StudioApi`, list/get/
  getPageBySlug/listVersions/create/saveDraft/publish/rollback/archive/validate schemas).
- `packages/schema/src/block.ts` — new block types `board-embed`, `link-list`,
  `custom-component`; `menu.ts` — new menu item type `page`.
- `packages/blocks` — configs + palette stubs for the three new block kinds.
- `apps/web/src/services/studio.ts` — `StudioPort` (= `StudioApi`), `SessionPort`, stubs,
  `StudioServicesProvider`, `useStudioPort`, `useSessionPort`.

## Tasks

| id | agent | owns | depends on | skills | status |
|----|-------|------|-----------|--------|--------|
| w0-contracts | orchestrator | contracts above | — | parallel-task-split | done |
| backend | top-level thread | `apps/api/**`, `apps/worker/**`, `deploy/**` db bits, `apps/web/src/services/api/**` | w0 | argus-ddl-migration, argus-realtime, argus-testing | todo |
| w1-pages-ops | ui-builder | `apps/web/src/features/{home,incidents,alerts,maps,live-data}/**` | w0 | argus-ui | todo |
| w1-pages-tables | ui-builder | `apps/web/src/features/tables/**` | w0 | argus-ui | todo |
| w1-pages-admin | ui-builder | `apps/web/src/features/{workflows,admin}/**` | w0 | argus-ui | todo |
| w1-code-editor | implementer | `packages/code-editor/**` (new) | w0 | argus-ui, argus-testing | todo |
| w1-sandbox | implementer | `packages/sdk/**` | w0 | argus-testing | todo |
| w2a-studio-shell | ui-designer (orchestrator) | `apps/web/src/routes/**`, `apps/web/src/features/studio/{shell,index}*`, dev-mode toggle | w1 | argus-ui | todo |
| w2b-builder | ui-builder | `apps/web/src/features/boards/**`, `apps/web/src/features/builder/**` (shared builder) | w2a, w1-code-editor | argus-ui, argus-board-block | todo |
| w2c-pages | ui-builder | `apps/web/src/features/pages/**` (runtime `/p/$slug`, page builder via shared builder) | w2b | argus-ui, argus-board-block | todo |
| w2d-components | ui-builder | `apps/web/src/features/studio/components/**` | w2a, w1-code-editor, w1-sandbox | argus-ui | todo |
| w3-demo | implementer | `apps/web/src/demo/studio/**` (demo StudioPort/SessionPort) | w2 | argus-testing | todo |
| final-test | tester | tests across the above | w3 | argus-testing | todo |
| final-review | reviewer | read-only: sandbox, permissions, audit, UI a11y | final-test | — | todo |

## Rules for every task

- Import contracts from `@argus/schema` / `apps/web/src/services/studio.ts`; never redefine them.
- UI uses `@argus/ui` (`PageContainer`, `PageHeader`, `Panel`, `EmptyState`, `ErrorState`,
  `Skeleton*`, `Button`, `Field` …) and token utilities; see `docs/ui/COMPONENTS.md`.
- No fake operational data outside `apps/web/src/demo/`. Stubs stay `TODO(implementation)`.
- Never `eval`/`new Function` user code in the app origin.
