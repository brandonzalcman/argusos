# Scaffold integration plan

Status: integration complete; scaffold verified. Review backlog below is open.

The project remains a scaffold. These waves fix composition, tooling and declarative infrastructure only; they do not implement product behavior.

## Contract decisions

- Keep Fastify, ElectricSQL, NATS JetStream, Graphile Worker and shared Zod contracts selected in `docs/STACK.md`.
- TypeScript remains 5.9.x, so tsconfig targets/libs remain ES2024 until a deliberate TypeScript upgrade.
- Use supported `@nats-io/transport-node` 3.5.0 instead of deprecated `nats`.
- Replace unusable/unmaintained `minio/*:latest` images. Garage is the preferred plan-sanctioned active S3-compatible alternative if a coherent pinned Compose configuration can be provided.
- No `latest` image tags. Host ports remain web 3000, API 3001, realtime 3002, Electric 3003 and Martin 3004.
- Dependency-provided agent skills remain disabled unless separately reviewed.
- Documentation may warn for intentional repository-only source references, but normal documentation links should be valid.

## Task table

| id            | agent               | owns                                                                       | depends on                       | skills                                                                         | status  |
| ------------- | ------------------- | -------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | ------- |
| foundation    | six scaffold agents | assigned `apps/*`, `packages/*`, `deploy/*`, `tests/*`, `packs/*`          | product plan                     | argus-scaffold-stub + area skills                                              | done    |
| contracts-fix | orchestrator        | root configs, field-type array typing, docs SSG workaround                 | foundation                       | parallel-task-split                                                            | done    |
| platform      | devops              | `deploy/**`, `.github/**`, root dependency/env files, app Dockerfiles      | contracts-fix                    | —                                                                              | done    |
| code-check    | tester/implementer  | application/package source, `tests/**`, `packs/**` except docs/Dockerfiles | contracts-fix                    | argus-testing, argus-field-type, argus-ddl-migration, argus-realtime, argus-ui | done    |
| docs-check    | docs-writer         | `apps/docs/**`, root Markdown docs except plan/stack                       | contracts-fix                    | —                                                                              | done    |
| final-verify  | orchestrator/tester | whole workspace, lockfile, CI-equivalent checks                            | platform, code-check, docs-check | argus-testing                                                                  | done       |
| final-review  | reviewer            | read-only security/audit/DDL/realtime/UI review                            | final-verify                     | —                                                                              | done       |

## Final verification

- Dependency install with frozen lockfile.
- Biome lint and formatting checks.
- Strict workspace and cross-project typechecks.
- All builds and todo-only unit tests, including explicit pack-test discovery.
- Playwright discovery and available declarative infrastructure validation.
- Review tenant/incident/field authorization seams, audit/versioning contracts, DDL/CEL safety, realtime recovery and UI accessibility claims.

Small review findings are fixed directly; larger findings return to an owning agent.

## Environment limitations

- Node 26.13.0 is available; Docker, Helm, k6 and global pnpm/Corepack are not available on the host.
- pnpm 12.21.0 is executed through a project-local npm cache/store.
- No container, live database, realtime service or browser behavior may be claimed as executed.

## Verification result (2026-11-18)

Executed on host: frozen-lockfile install (after catalog lockfile regeneration), `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (20/20), `pnpm build` (15/15), `pnpm test` (20/20, todo-only). Biome now excludes generated output (`playwright-report`, `.turbo`, caches) and Markdown (its Markdown formatter corrupts front matter).

Not executed: Docker/Compose, Helm, live database, NATS/Electric/realtime, Playwright browsers.

## Review backlog (final-review findings, for implementers)

Contracts (fix before implementing the owning slice):

1. `packages/schema/src/record.ts` create input accepts client `incidentId`/`tableId`; derive incident from `OperationContext`, reject path mismatch.
2. `apps/api/src/persistence/repositories.ts` `UpdateCatalogEntity` lets scoping/tombstone columns be patched; use per-entity patch types.
3. `positionId` nullable in API context/repositories but required in `packages/schema/src/context.ts`; make non-null or add a distinct system-actor type.
4. `packages/ddl-engine/src/model.ts` RLS snapshot: `forceForTableOwners` literal `true`; require incident binding when `scope` is `incident`.
5. Brand SQL (`SafeSql`, `SafeIdentifier`) in ddl-engine and expr; no plain-string statements.
6. `apps/realtime` protocol redefines envelope; import `packages/schema/src/realtime.ts`.
7. Realtime auth: upgrade is the only authentication step; add `reauthenticate` and server `auth-revoked` frames, resume token tied to user.
8. Electric bypasses RLS via replication: add an API shape proxy enforcing tenant/incident/field access; keep Electric private.
9. Web client builds `AuditMetadata`; make it server-derived.

Infrastructure:

10. Dockerfiles copy the full build tree; use `pnpm deploy --prod`, digest-pin bases, add `apps/web` image.
11. Helm: default resource limits, require image digests in production, per-workload Secrets, NetworkPolicy.
12. NATS has no auth; add per-tenant permissions. Pin GitHub Actions by SHA.
13. Local compose passwords are fixed literals (loopback only); source from env interpolation and add a CI guard against reaching Helm.
