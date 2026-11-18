# Web demo mode (mock data)

Goal: let maintainers see the operations UI with realistic data before the API, ElectricSQL and auth exist.

## Rules

- Opt-in only: `pnpm dev:demo` (root) or `pnpm --filter @argus/web dev:demo` → `vite --mode demo` → `apps/web/.env.demo` sets `VITE_ARGUS_DEMO=true`.
- The default build still uses the honest throwing stubs. Nothing in `features/` imports from `src/demo/`.
- A permanent banner states the data is fictional. All data is invented (see `src/demo/scenario.ts`).
- Demo adapters implement the existing ports exactly; they never change a port contract.
- State is in-memory per tab; mutations (edits, sends, saves) update that memory so the UI reacts.

## Foundation (done by orchestrator)

- `features/live-data/active-scope.ts`: `ActiveScopeProvider` context (default `null`).
- `features/live-data/feature-sources.ts`: `FeatureSourcesProvider` for incidents/alerts/maps (default stubs).
- `src/demo/demo-mode.ts`, `scenario.ts` (shared ids/helpers), `demo-providers.tsx` (provider stack + banner).
- `app/app-providers.tsx` mounts `createDemoServices()` + `DemoProviders` only in demo mode.

## Wave 1 (parallel)

| Task | Files owned | Exports |
| --- | --- | --- |
| A. Ops + services | `src/demo/services.ts`, `incidents.ts`, `alerts.ts`, `maps.ts` | `createDemoServices`, `demoIncidentsSource`, `demoAlertsSource`, `demoMapsSource` |
| B. Tables | `src/demo/tables/**` | `createDemoTablesDataPort` |
| C. Boards | `src/demo/boards/**` | `createDemoBoardsEnvironment` |
| D. Admin + workflows | `src/demo/admin.ts`, `src/demo/workflows.ts` | `createDemoAdminService`, `createDemoWorkflowService` |

## Verification

`pnpm --filter @argus/web typecheck`, `test`, `pnpm lint`, then a browser pass of every route in demo mode.
