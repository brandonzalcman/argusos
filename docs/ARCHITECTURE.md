# ArgusOS architecture contract

Status: scaffold. This document fixes boundaries so independent implementation tasks do not grow incompatible architectures. Product requirements are in [PRODUCT_PLAN.md](PRODUCT_PLAN.md).

## 1. Runtime topology

```text
React / Expo clients
  ├─ HTTPS: Fastify ─ tRPC (first party) + /api/v1 REST/OpenAPI (integrations)
  ├─ HTTPS: ElectricSQL ─ authorized row shapes / live query synchronization
  └─ WSS: realtime gateway ─ presence, editing hints, alerts, reconnect state
                                      │
                         NATS JetStream event subjects
                                      │
             API change publisher ─ worker jobs ─ integration adapters
                                      │
                       PostgreSQL 18 + PostGIS (source of truth)

Graphile Worker uses PostgreSQL for durable jobs. S3 stores file bytes; Postgres
stores file metadata. Martin reads approved PostGIS sources for vector tiles.
OpenTelemetry spans cross API, SQL, NATS, workers and client render receipts.
```

The API must not bypass PostgreSQL row-level security. Realtime subjects and Electric shapes must enforce the same tenant, incident, position and field permissions as normal reads. NATS is not a client-visible authorization boundary; only the gateway/API can authenticate and authorize subscribers.

## 2. Metadata and physical data

- `meta` contains versioned table, field, relation, board, view, workflow, menu, position and theme definitions.
- `data` contains physical user tables named `t_<short_id>` and read views named `v_<short_id>`. Schema-per-tenant remains a deployment convention, never an identifier derived from user input.
- `audit.record_changes` is append-only and partitioned. Business updates and their audit records must commit atomically.
- Drizzle owns stable system catalog migrations. `@argus/ddl-engine` owns user-table migration plans; it must not run Drizzle migrations or generate runtime application code.
- Every mutable record has optimistic `version`, actor/position/incident provenance, timestamps and soft-delete state. API writes must document conflict behavior.

## 3. Draft, preview, publish and rollback

Definitions have immutable published versions and separate drafts. A publish operation validates dependencies and permissions, creates a migration/impact plan, previews destructive effects, persists the version and executes physical changes in one explicit transaction boundary. Active-incident restrictions and online backfill are required before risky changes.

Rollback restores a definition version and creates a new auditable version; it does not rewrite history. Physical destructive changes use retained renamed columns until retention expires.

## 4. Write and event flow

1. Authenticate the user and select an authorized position/incident context.
2. Authorize the action and fields; validate against the published definition.
3. Start a transaction and set PostgreSQL session context for RLS/audit.
4. Apply the optimistic write and append field-level audit changes.
5. Commit, recording WAL/commit metadata.
6. ElectricSQL propagates authorized row changes to clients.
7. A change publisher forwards committed changes to NATS in WAL order. Publishing needs an outbox/idempotency design; no dual-write assumption is allowed.
8. Workflow/integration consumers process durable, idempotent events.

Alerts and presence use the gateway; durable alert state still lives in PostgreSQL. Presence is advisory and expires. It is never a correctness lock.

## 5. Client consistency

- Reads use the sync cache once implemented; connection state and last successful update stay visible.
- Mutations carry record version and idempotency identity. Offline work replays through the same server authorization path.
- Different-field merges require explicit server semantics. Same-field conflicts return both values and require resolution; clients cannot silently overwrite.
- New list rows are buffered behind a user-controlled indicator rather than unexpectedly moving the viewport.
- Live-sync failure enters visible reconnect/polling states. The five-second polling fallback must not bypass field or row permissions.

## 6. Extension boundaries

A field type supplies validation, DDL metadata, import/export and UI extension slots. A board block receives typed data/capability ports, never unrestricted database or network access. CEL is sandboxed, typed and resource-limited; SQL compilation uses identifiers from trusted metadata and bound values only.

Plugins run in sandboxed iframes or isolated workers with explicit capabilities, scoped tokens, origin checks and message schemas. An iframe `postMessage` event is untrusted until origin, source, request identity and payload are validated.

## 7. API boundaries

- tRPC is private to the version-matched first-party web/mobile clients.
- REST under `/api/v1` is stable, documented with OpenAPI 3.1 and authorized using scoped credentials.
- Generated record APIs are derived from published metadata and cannot expose hidden fields in errors, filters, ordering or OpenAPI output.
- Health endpoints expose liveness/readiness without leaking connection strings, tenant names or dependency internals.

## 8. Security invariants

1. Deny by default for tenant, incident, position and field access.
2. Enforce row isolation in PostgreSQL, not only in TypeScript.
3. Treat metadata and plugin messages as untrusted input; bound sizes and validate identifiers.
4. Keep audit append-only and include request/correlation IDs, actor, position and incident.
5. Never store file bytes or provider secrets in board definitions or event payloads.
6. Encrypt transport and secret material; Compose credentials are development-only.
7. Rate limit public forms, authentication, feed ingestion and outbound provider adapters.
8. Exercises/drills remain explicitly separated from live incident data in queries, events and exports.

## 9. Observability and proof

Metrics and traces must not include sensitive record values. Track commit-to-render latency, reconnect catch-up, event consumer lag, alert delivery and failure rates. Performance targets in the plan require reproducible load tests and production telemetry; scaffold files are not proof of meeting them.
