# Dev mode (studio): board, page and component builder + page polish

Status (2026-11-19): UI waves done and verified in demo mode (studio, board Code view, pages, component editor, eject, sandbox, page blocks). Backend thread still running. Remaining: real data for custom-component hooks, pickers (table/field/page), rollback in component versions, final reviewer pass on sandbox + permissions.

Ownership note (2026-11-19, user decision): the feature-page sessions (boards; tables; home/incidents/alerts/maps; workflows/admin) own their `features/*` folders. This plan touches them only via exports and messages.

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
| backend | thread "Backend: API, session and studio persistence" | `apps/api/**`, `apps/worker/**`, `deploy/**` db bits, `apps/web/src/services/api/**` | w0 | argus-ddl-migration, argus-realtime, argus-testing | done — see [backend plan](2026-11-19-backend-studio-session.md); wire `createApiServices()` from `apps/web/src/services/api` into `StudioServicesProvider` |
| w1-pages-ops | session "UI: home, incidents, alerts, maps pages" | `apps/web/src/features/{home,incidents,alerts,maps,live-data}/**` | w0 | argus-ui | handed to that session (user decision) |
| w1-pages-tables | session "UI: tables list, data grid, designer" | `apps/web/src/features/tables/**` | w0 | argus-ui | handed to that session |
| w1-pages-admin | session "UI: workflows and admin pages" | `apps/web/src/features/{workflows,admin}/**` | w0 | argus-ui | handed to that session |
| w1-code-editor | implementer | `packages/code-editor/**` (new) | w0 | argus-ui, argus-testing | done (typecheck/build/24 tests) |
| w1-sandbox | implementer | `packages/sdk/**` | w0 | argus-testing | done (72 tests; Edge-verified CSP, capability denial, watchdog) |
| w2a-studio-shell | ui-designer (orchestrator) | `apps/web/src/routes/**`, `apps/web/src/features/studio/{shell,index}*`, dev-mode toggle | w1 | argus-ui | done (/studio, dev-mode toggle/banner, session labels, DefinitionCodeView) |
| w2b-builder | session "UI: boards list, runtime, builder, diff" (owns `features/boards/**`) | board Code view, per-block code, editCode gating, reusable builder exports | w2a, w1-code-editor | argus-ui, argus-board-block | done (Code view, block Code tab, eject hook, page/link/embed/custom-component rendering, canvas polish) |
| w2c-pages | ui-builder | `apps/web/src/features/pages/**` (runtime `/p/$slug`, page builder via shared builder) | w2b | argus-ui, argus-board-block | done (32 tests, browser-verified) |
| w2d-components | ui-builder | `apps/web/src/features/studio/components/**` | w2a, w1-code-editor, w1-sandbox | argus-ui | done (25 tests, sandbox preview verified) |
| w3-demo | implementer | `apps/web/src/demo/studio/**` (demo StudioPort/SessionPort) | w2 | argus-testing | done (15 tests) |
| final-test | tester | tests across the above | w3 | argus-testing | todo |
| final-review | reviewer | read-only: sandbox, permissions, audit, UI a11y | final-test | — | todo |

## Rules for every task

- Import contracts from `@argus/schema` / `apps/web/src/services/studio.ts`; never redefine them.
- UI uses `@argus/ui` (`PageContainer`, `PageHeader`, `Panel`, `EmptyState`, `ErrorState`,
  `Skeleton*`, `Button`, `Field` …) and token utilities; see `docs/ui/COMPONENTS.md`.
- No fake operational data outside `apps/web/src/demo/`. Stubs stay `TODO(implementation)`.
- Never `eval`/`new Function` user code in the app origin.
