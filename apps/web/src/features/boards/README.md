# Boards feature (`/boards`, `/boards/$boardId`, `…/builder`, `…/diff`)

Runtime board renderer, builder (palette, canvas, inspector, multi-select, copy/paste, undo/redo,
"preview as position") and version diff with audited publish/rollback.

## Required wiring at the app root

The pages read everything from `BoardsEnvironmentProvider` (`environment.tsx`). Without it they
render the explicit "No authenticated session scope" state and make no request.

```tsx
<BoardsEnvironmentProvider
  environment={{
    scope, // OperationContext: tenantId, userId, positionId, incidentId, requestId, authenticatedAt
    repository, // BoardsRepositoryPort (model.ts): list/getPublished/getDraft/listVersions/getVersion/saveDraft/publish/rollback
    data, // BoardDataPort from @argus/blocks (scoped, RLS-enforced reads/writes)
    expressions, // ExpressionValidationPort (expression.ts); createCelValidationPort() once @argus/expr is implemented
  }}
>
  {children}
</BoardsEnvironmentProvider>
```

- **Demo mode:** `src/demo/demo-providers.tsx` already mounts it with `createDemoBoardsEnvironment()`
  (`pnpm --filter @argus/web dev:demo`). Production needs the real adapters above, mounted next to
  the other feature providers in `app/app-providers.tsx` (owned elsewhere; see
  `docs/plans/web-demo-mode.md`).
- **Also required (already in the app tree):** `AppServicesProvider` (`authorizationPreview` for
  "preview as position") and `AdminServiceProvider` (`listPositions`), `QueryClientProvider`,
  `UIPreferencesProvider`/`TooltipProvider`/`ToastProvider` from `@argus/ui`.
- **Security:** every query key includes tenant/incident/position; server permissions
  (`BoardSummary.permissions`) gate Edit/Publish; visibility conditions fail closed until
  `@argus/expr` can evaluate them.

## Not yet connected (TODO(implementation))

`renderBoard` and block `render` in `@argus/blocks` throw, so `board-renderer.tsx` implements the
`BoardRendererPort` for the web app; `@argus/expr` `parseCel`/`typeCheckCel` throw, so the condition
editor reports "not validated". Live updates poll every 5 s until an Electric adapter exists.
