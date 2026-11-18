# @argus/worker

Graphile Worker composition and durable job contracts for workflows, alerts, transfers, webhooks, feeds, and audit retention. Handlers intentionally throw and no database, queue, provider, feed, or object-storage work occurs.

## Implementation order

1. Validate worker configuration, run the Graphile Worker schema migration separately, and compose least-privilege PostgreSQL, alert, storage, and telemetry ports.
2. Define versioned payload schemas and a shared execution context. Every payload carries tenant, optional incident, actor/system initiator, correlation, and idempotency identity; never deserialize arbitrary executable code.
3. Implement transactional workflow run/step state, durable delays, bounded exponential retries, poison-job handling, approval expiry, and exactly-once effects through idempotency records. Graphile retries alone do not make provider effects idempotent.
4. Implement alert delivery, acknowledgement tracking, and escalation using `@argus/alerts`. Record provider attempts and acknowledgements in append-only audit history.
5. Add import dry-runs, export authorization/FLS, signed file lifecycle, webhook signing/replay protection, and outbound allowlists/SSRF controls.
6. Add feed mapping, stable-source dedupe, per-feed rate limits and health, high-frequency partitioning hooks, and legal-hold-aware audit retention. Jobs must re-establish RLS session claims in every transaction.
7. Test crash recovery, duplicate delivery, retries, tenant isolation, incident scoping, revoked credentials, approvals, retention holds, and redaction of secrets/personal data from logs.

Workers use system tables through Drizzle and physical user tables only through approved repositories/DDL contracts. They must not bypass field-level security for exports or integrations.

The Dockerfile is a build scaffold only. It has not been built or run.
