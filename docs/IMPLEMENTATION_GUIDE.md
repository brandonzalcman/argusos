# Implementation guide

This repository is intentionally a scaffold for subsequent implementation agents. The goal is small, verifiable vertical slices—not filling every `throw` in one pass.

## How to complete a stub

1. Read the package README, its public contracts, [ARCHITECTURE.md](ARCHITECTURE.md) and relevant product-plan section.
2. Pick one vertical slice and list the contracts you will change. Keep unrelated public exports stable.
3. Replace a specific `TODO(implementation)` with behavior and meaningful tests. Do not leave a placeholder return value that looks operational.
4. Add negative tests first for authorization, tenant/incident isolation, validation and conflict handling where applicable.
5. Update dependent schemas, OpenAPI/tRPC contracts, migrations, docs and infrastructure together.
6. Run formatting, lint, strict typecheck, builds and affected tests. Run real database/browser tests when the slice needs them.
7. Record remaining `TODO(decision)`/`TODO(verify)` items explicitly. Never describe todo-only tests or healthy containers as feature verification.

## Recommended vertical slices

### Foundation slice: identity and incident context

- Implement environment loading, PostgreSQL connectivity and initial Drizzle migrations.
- Implement local auth plus one OIDC path, tenant/user/position/incident persistence and session context.
- Add RLS policies and tests using two tenants, two positions and live/exercise incidents.
- Expose a minimal authenticated current-context API and display it in the web shell.

Exit condition: cross-tenant and unauthorized-position reads fail in both API and direct SQL tests; audit context is present.

### Table slice: one safe text table end to end

- Implement table/field drafts for text, number, boolean, date-time, select, user, relation and the remaining selected core types.
- Implement additive DDL planning and execution with identifier/injection tests.
- Implement versioned record create/read/update with optimistic locking, soft delete and atomic audit history.
- Publish committed changes through the designed outbox/change path and subscribe one grid.
- Add inline editing, conflict UI, reconnection and visible connection state.

Exit condition: two browsers update one authorized table with no missed changes after reconnect; RLS and field-level restrictions hold for API, sync and events.

### Board slice: generated list/detail/form

- Implement board definitions and generate list/detail/input views from one published table.
- Implement the 12-column layout and a minimal accessible block set before drag/drop polish.
- Add CEL visibility/validation with resource limits and parameterized SQL compilation tests.
- Implement preview-as-position, visual version diff, publish and restore.

Exit condition: one generated board is usable with keyboard and mobile layouts; hidden/unauthorized data never reaches the client.

### Workflow and alert slice

- Implement record/button triggers, condition/update steps, durable runs, idempotent retries and a run log.
- Add in-app and email delivery, acknowledgement state and escalation before external SMS/voice adapters.
- Add provider timeout/rate-limit tests and secret handling.

### Later slices

Homepages/presence, maps, import/export, packs, public forms, plugin runtime and mobile each need their own threat model and acceptance tests. Do not start all adapters or all block types merely to remove stubs.

## Implementation order inside a file

Prefer this dependency direction:

```text
schema types -> pure validation/planning -> persistence ports -> adapters
             -> application service -> API/event transport -> UI
```

UI may be built against fake **test fixtures** in tests, but the product shell must clearly show unimplemented/unavailable states instead of presenting fixture data as real incidents.

## Required test layers

- **Unit:** deterministic planners, validators, CEL, permissions and conflict decisions.
- **Database integration:** real PostgreSQL 18/PostGIS for RLS, DDL, audit, optimistic locking and transactional behavior.
- **Contract:** tRPC/REST/OpenAPI, WebSocket/NATS message schemas and plugin messages.
- **Browser:** keyboard/accessibility, builder publish flow, conflict and reconnect UX.
- **Load/chaos:** realistic authenticated connections, WAL/event lag and loss detection. A k6 script alone does not satisfy a target.

## Pull request checklist for future implementation

- [ ] The slice is explicit and no unrelated stubs were filled.
- [ ] Authorization and tenant/incident isolation have negative tests.
- [ ] Audit and version behavior are covered for mutations.
- [ ] No raw user value is interpolated into SQL, shell commands or HTML.
- [ ] Public contracts and docs match behavior.
- [ ] No secrets, real incident data or unreviewed generated artifacts were added.
- [ ] Checks that actually ran are listed; unavailable Docker/browser checks are disclosed.
