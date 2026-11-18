# ArgusOS builder guide

## Mission

ArgusOS is a self-hosted crisis and incident management platform. The product plan is in `docs/PRODUCT_PLAN.md` — read only the section you need.

This repository is currently an **implementation scaffold**, not a working product. Establish architecture, contracts, infrastructure, typed interfaces, and tests to implement later. Do not silently replace a stub with business logic unless a task explicitly asks for implementation.

## Fixed technical choices

- TypeScript strict, ESM only, Node.js 26 LTS; pnpm workspaces/catalogs and Turborepo.
- React 19, Vite 8, TanStack Router/Query, Tailwind CSS 4, Radix, Motion, Storybook.
- Fastify + tRPC for the internal app API; versioned REST + OpenAPI 3.1 for integrations.
- PostgreSQL 18 + PostGIS, Drizzle for system tables, the DDL engine for physical user tables.
- ElectricSQL for row sync; NATS JetStream for domain events; WebSocket gateway for presence/alerts.
- Graphile Worker for durable jobs; S3-compatible object storage; MapLibre/Martin for maps.
- Biome, Vitest, Playwright, Testcontainers; Docker Compose and Helm for deployment.

## Repository ownership

- `apps/web`: operations UI, runtime board renderer, table designer, board/workflow builders.
- `apps/api`: system catalog persistence, authz, app/REST APIs, generated table APIs.
- `apps/realtime`: authenticated WebSocket protocol, presence, alert fan-out, health.
- `apps/worker`: workflow, alert, import/export and feed-processing job entry points.
- `apps/mobile`, `apps/docs`: Expo responder shell and documentation site.
- `packages/schema`: shared Zod definitions and inferred types; no runtime infrastructure.
- `packages/ddl-engine`: safe migration planning contract; SQL generation must be injection-safe.
- `packages/field-types`, `packages/blocks`, `packages/maps`, `packages/ui`: registries and typed contracts.
- `packages/expr`: CEL parsing/evaluation/SQL compilation ports; never interpolate values into SQL.
- `packages/alerts`, `packages/sdk`: channel adapter and sandboxed plugin contracts.
- `deploy`, `.github`, `tests`: local/production infrastructure and cross-project verification.

## Stub convention

Every implementation gap must be obvious and searchable:

```ts
/**
 * TODO(implementation): one precise sentence describing the behavior.
 * Input: ...
 * Output: ...
 * Errors: ...
 * Depends on: ...
 */
export function example(): never {
  throw new Error("TODO(implementation): example");
}
```

- Use `TODO(implementation)` for behavior, `TODO(decision)` for unresolved product choices, and `TODO(verify)` for assumptions needing external validation.
- Components may render accessible, clearly labeled scaffold placeholders; no fake data presented as real operational data.
- Tests should describe intended behavior with `it.todo`/`describe.todo`; do not add meaningless passing assertions.
- Keep security, audit, tenant isolation, incident scoping and optimistic versioning in every relevant contract.
- No secrets in source. No license file until the maintainers resolve the license decision in the plan.

## Routing (orchestrator reads this on every prompt)

Only the orchestrator delegates. Subagents never call other agents; they do their task and report.

Handle it yourself only if it is a question, a one-file fix under ~20 lines, or a plan. Otherwise delegate (If Claude being used delegate to Sonnet5.5 or Haiku5.5 where possible otherwise use Opus5.5)

| If the task is…                                                             | Agent       | Load skills                        | Parallel      |
| --------------------------------------------------------------------------- | ----------- | ---------------------------------- | ------------- |
| Finding where something is / how it works                                   | explorer    | —                                  | yes           |
| New package, module or file structure (stubs)                               | scaffolder  | argus-scaffold-stub (+ area skill) | yes           |
| Filling in non-UI code (API, DDL, workers, sync)                            | implementer | area skill                         | yes           |
| Design system, app shell, a key screen, anything that sets a visual pattern | ui-designer | argus-ui                           | one at a time |
| Components, board blocks, secondary screens using existing patterns         | ui-builder  | argus-ui (+ argus-board-block)     | yes           |
| Docker, Compose, Helm, CI, env vars                                         | devops      | —                                  | usually one   |
| Writing or running tests                                                    | tester      | argus-testing                      | yes           |
| Checking work touching permissions, audit, DDL, real time or UI             | reviewer    | —                                  | yes           |
| READMEs, docs site, ADRs                                                    | docs-writer | —                                  | yes           |

Area skills: `argus-field-type` · `argus-board-block` · `argus-ddl-migration` (any schema/SQL) · `argus-realtime` (live data, ElectricSQL, NATS) · `argus-ui` (any UI) · `argus-testing` · `parallel-task-split` (planning any multi-file work).

Multi-file work: load `parallel-task-split`, write the plan to `docs/plans/`, fix contracts in `packages/schema`, then dispatch each wave's tasks in one message. Name the skills to load in every brief.

## Working rules for agents

- Import shared types from `packages/schema`; never redefine them locally. Packages are named `@argus/<name>`; internal deps use `workspace:*`, external versions come from the pnpm catalog.
- Stay inside the files you were assigned. If you need a change elsewhere, report it instead of making it.
- Every user-table change goes through the DDL engine, never raw `ALTER TABLE` in app code.
- Data shown on screen comes from a live query (ElectricSQL), not a one-off fetch.

## Commands

After dependencies are installed:

- `pnpm build` — build packages/apps through Turbo.
- `pnpm typecheck` — strict TypeScript checks.
- `pnpm lint` / `pnpm format:check` — Biome checks.
- `pnpm test` — unit test suites; scaffold tests may be todo-only.
- `pnpm test:e2e` / `pnpm test:integration` — later real-browser/database suites.
- Single package: `pnpm --filter @argus/<name> <script>`.

## Definition of done for implementation work

Implement one vertical slice at a time. Preserve the public contracts documented in each stub, add meaningful tests, enforce authorization at API and database layers, update the relevant docs, and run the checks above. Do not claim Docker, database, realtime, or E2E behavior has been executed unless it actually ran. Report the real result of every check you ran.
