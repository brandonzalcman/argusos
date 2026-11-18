---
title: Security, RLS and audit
---

:::danger Scaffold — no security assurance
Typed contracts are not enforcement. Authentication, database policies, immutable audit storage, cryptography and threat testing are not implemented and must be independently verified before production use.
:::

## Access model

Authorization combines position-based RBAC with CEL ABAC constraints for tenant, incident, jurisdiction and field sensitivity. Both API and database layers enforce access; the database remains a backstop against an API authorization bug.

At minimum, database transactions establish trusted session context for tenant, user, active position and incident. RLS policies apply to every user table and system-owned record with tenant scope. Global tables require explicit sharing policy rather than an implicit cross-incident bypass.

Exercises and live incidents must be isolated. Export, background jobs, realtime subscriptions, API keys and plugins need the same constraints as interactive queries.

## Sensitive boundaries

- Do not trust tenant or incident IDs supplied by a mobile route, event, pack or plugin.
- Do not place media URIs, location history, tokens, secrets or sensitive field values in logs.
- Use encrypted transport, at-rest storage and per-user encrypted mobile draft storage.
- Limit field reads and writes independently; hidden is not the same as read-only.
- Public submissions enter review quarantine with malware scanning, rate limits and captcha policy.
- Signing and encryption keys have explicit ownership, rotation, revocation and backup procedures.

## Audit contract

Every accepted record mutation appends an immutable change containing tenant, table, record, incident, actor, position, field-level before/after diff, trusted timestamp and request ID. Definition publishes, auth events, acknowledgements, workflow decisions, exports, pack installs and administrative actions also need audit events.

Audit access is separately authorized and audited. Retention/export behavior must preserve legal-evidence requirements without promising immutability before storage constraints exist.

## Required adversarial tests

1. Cross-tenant reads and writes fail at API and RLS layers.
2. Cross-incident subscriptions and event consumers receive nothing.
3. A position cannot read a hidden field through export, search, realtime or errors.
4. Stale versions cannot overwrite newer values.
5. Replayed mutations use idempotency and cannot duplicate audit-visible effects.
6. A plugin cannot escape experiments/subjects, resource budgets or scoped protocol tokens.
7. Audit alteration and unauthorized export are denied and tested.

See [Realtime and events](./realtime-and-events.md) for stream scoping and [Plugin implementation](./plugin-implementation.md) for sandbox boundaries.
