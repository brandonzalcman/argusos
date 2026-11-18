---
title: Realtime and event flows
---

:::warning Planned pipelines
ElectricSQL, NATS JetStream and the WebSocket gateway are architectural choices here, not connected or load-tested services in this scaffold.
:::

## Two complementary pipelines

**Row sync:** PostgreSQL is authoritative. ElectricSQL consumes committed logical-replication changes and updates authorized client live queries. Boards, grids, dashboards and maps observe committed versions without hand-written row sockets.

**Domain events:** NATS JetStream carries alert triggers, workflow steps, webhooks, feed input and presence-related events. Durable consumers acknowledge explicit checkpoints. Exchanges, experiments, subjects and protected publications are API concerns, not client-side globals.

A planned change service translates committed WAL changes into ordered domain events. Derived workflows and integrations must not observe uncommitted mutations.

## Subject and subscription scope

Use server-reviewed naming that binds tenant and incident into subject ACLs. Credentials are least-privilege and short-lived. Consumers also authorize each payload because a subject name alone is not proof of row visibility.

Field-level filtering happens before publication to an unauthorized recipient. Reconnect and replay cannot broaden scope after a position or incident membership changes.

## Ordering and conflicts

- Order row changes by WAL position and include record `version`.
- Define per-consumer idempotency and duplicate handling.
- Use monotonic workflow checkpoints; do not infer correctness from arrival wall-clock time.
- Flag same-field concurrent edits and leave resolution to explicit policy.
- Treat presence as ephemeral and non-authoritative.

## UX contract

Connection state is always visible: live, reconnecting or offline, with last confirmed update time. A failed stream eventually produces a visible polling-fallback state rather than a silent stale screen. Mobile drafts remain explicitly unsubmitted until server confirmation.

## Verification gates

Measure commit-to-render latency and alert delivery in integration/load environments. Test disconnects, replay, gateway loss, NATS consumer restart and permission revocation. The product plan's target of 2,000 concurrent users and p95 below 250 ms is a test target, not a measured result.

Source ownership: `apps/realtime/`, `apps/worker/` and `apps/api/`.
