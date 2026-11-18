# @argus/mobile

Expo + Expo Router responder **scaffold**. It contains typed routes and public contracts only. It does not authenticate users, select a live incident, fetch tasks, render real boards, access GPS/camera/push, store drafts, resolve conflicts or acknowledge alerts.

Every screen visibly identifies itself as a scaffold. `scaffold-board` and `scaffold-alert` are navigation placeholders, not operational records. All capability functions in `src/capabilities.ts` throw `TODO(implementation)`.

## Public contract

- `src/contracts.ts` defines tenant/user/position/incident scope, check-in, task, board/form, capture, alert and offline types.
- `src/capabilities.ts` defines the async/service boundaries and their authorization, audit, storage and concurrency semantics.
- `src/index.ts` exports those contracts. `pnpm build` emits ESM JavaScript and declarations to `dist/` when dependencies are available.
- `app/` is the typed Expo Router application shell; `src/components/ScaffoldScreen.tsx` provides accessible placeholder content.
- `app.json` enables the New Architecture and typed routes. Platform identifiers and permission text are placeholders and require product/security review before a native build.
- `tests/mobile-shell.test.ts` contains only intended-behavior TODO tests.

Shared board definitions must come from `@argus/schema`; mobile must not fork board JSON types or execute plugin code. Client-provided tenant and incident identifiers are claims to re-authorize, never authorization proof. Local media, push tokens and drafts are sensitive and require encrypted, partitioned storage.

## Implementation order

1. Stabilize shared `@argus/schema` board, record, user, position and incident contracts.
2. Add authenticated session/incident selection and server-authorized read clients.
3. Implement read-only assigned tasks and published board rendering with field-level permissions.
4. Implement server-confirmed check-in and alert acknowledgement with optimistic versions and audit receipts.
5. Add encrypted per-user offline drafts, idempotent replay and explicit same-field conflict UX.
6. Add consented photo/GPS capture and push registration behind explicit user actions.
7. Add Exercise/live-mode isolation, accessibility, offline/connection indicators and real-device tests.

Roadmap note: the product plan schedules the full mobile application after v1.0. This shell establishes boundaries now; it is not evidence that the mobile feature is delivered.

## Commands (after the root catalog and dependencies are installed)

- `pnpm --filter @argus/mobile build`
- `pnpm --filter @argus/mobile typecheck`
- `pnpm --filter @argus/mobile test`
- `pnpm --filter @argus/mobile dev` (opens Expo tooling; it does not make capability stubs operational)
