# @argus/ddl-engine

Contracts for diffing ArgusOS catalog definitions and planning safe PostgreSQL migrations for physical user tables. This package currently contains **no SQL generation or execution implementation**.

## Boundaries

- Diff immutable live snapshots against optimistic drafts; never infer changes from display names.
- Allocate stable `t_<short_id>` tables and `v_<short_id>` read views. Display-name renames are catalog-only.
- Model every statement as quoted identifiers plus separate PostgreSQL parameters. Raw values and raw DDL are not accepted.
- Keep removal soft through `_deleted_` tombstones and an explicit retention deadline. Rollback creates a new audited version rather than rewriting history.
- Execute DDL, backfill, catalog compare-and-swap, RLS verification, and append-only audit in one transaction.
- Require tenant identity everywhere and incident binding for incident-scoped rows. Global tables remain tenant-isolated.
- Local identifier, expression, and field-type references are narrow integration ports. Replace or adapt them when `@argus/schema`, `@argus/expr`, and `@argus/field-types` expose canonical contracts; do not duplicate their implementations here.

## Public modules

- `model`: draft/live definitions, security context, retention, audit, and RLS metadata.
- `operations`: migration operation union, conversion preflight, plans, steps, previews, and approvals.
- `sql`: identifier/value safety contracts and physical naming stubs.
- `ports`: transaction, catalog, audit, RLS, and preflight infrastructure interfaces.
- `engine`: diff, preflight, plan, preview, validation, and transactional execution stubs.
- `publication`: optimistic publish and forward-migration rollback stubs.

## Implementation order

1. Finalize shared schema adapters and field-type conversion capabilities; add identifier and parameter conformance tests.
2. Implement pure snapshot diffing and destructive-retention classification, including deterministic operation ids and plan digests.
3. Implement safe SQL construction and read-only conversion preflight; prove injection resistance and redacted previews.
4. Implement plan validation, plain-language previews, active-incident lock policy, and optimistic version guards.
5. Implement PostgreSQL transaction/catalog/audit/RLS adapters, then atomic execution and publication against Testcontainers.
6. Implement rollback as a newly planned forward version, followed by retention-expiry purging as a separately authorized durable job.

The tests are intentionally todo-only until each vertical slice is implemented. No database or external service is connected by this scaffold.
