# @argus/web

Buildable Vite/React SPA shell with code-based TanStack routes and Query providers. Every route is explicitly labelled as scaffold-only. Service factories in `src/services` throw rather than pretending that sync, realtime, offline, presence, authorization, search, or telemetry is connected.

## Implementation order

1. Add authenticated session, tenant, active incident, position, operational period, and route-loader contracts from `@argus/schema` and `apps/api`. Reject unauthorized cross-incident navigation before rendering.
2. Implement Electric live queries and persistent TanStack Query integration, then the encrypted offline mutation queue, optimistic versions, field conflicts, and five-second polling fallback.
3. Implement authenticated WebSocket/NATS-gateway health, alert subscriptions, presence, command palette, and redacted OpenTelemetry instrumentation through `src/services` without changing route consumers.
4. Build table grid/designer and board runtime/builder/diff vertical slices using `@argus/blocks`; the renderer defaults to the shared `@argus/schema` board definition. Add server-authoritative RBAC/ABAC preview.
5. Implement React Flow workflows, MapLibre maps via `@argus/maps`, alerts, administration/homepages, and settings only as their owning backend contracts become available.
6. Replace route/test todos with accessible interaction, offline/reconnect, tenant-isolation, audit, and performance tests. Add polished design only after the operations flows are correct.

## Demo mode

`pnpm dev:demo` (or `pnpm --filter @argus/web dev:demo`) runs Vite with `--mode demo`, which loads `.env.demo` (`VITE_ARGUS_DEMO=true`). `AppProviders` then swaps every port for the in-memory adapters in `src/demo/`, built around a fictional scenario (`src/demo/scenario.ts`, the Harlow River flood). A permanent banner marks the data as fictional. Edits, alert sends, board publishes and workflow saves change only that tab's memory. Feature code never imports `src/demo/`. `src/demo/demo-data.test.ts` checks the mock data against the `@argus/schema` contracts. The normal `dev` and `build` scripts are unaffected.

The default build deliberately has no generated operational rows, incidents, users, alerts, or map features. `AppProviders` accepts an `AppServices` composition root so real adapters can be introduced without global service imports in components.
