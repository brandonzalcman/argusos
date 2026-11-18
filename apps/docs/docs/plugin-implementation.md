---
title: Plugin implementation guide
---

:::danger No sandbox is implemented
Iframe isolation, scoped tokens, worker execution budgets and permission grants must exist before third-party plugin code can run.
:::

## Trust boundary

Custom blocks and field types run in sandboxed iframes and communicate through the typed protocol in `packages/sdk/`. They never receive host session credentials, arbitrary network access or direct DOM/database access. A stable host API exposes explicitly authorized operations such as read-current-record, request-update and subscribe.

Server plugins run in isolated workers with scoped API tokens, tenant/incident constraints, resource budgets, outbound-network policy and auditable action requests. Channel adapters in `packages/alerts/` follow separate minimum-privilege contracts.

## Versioning contract

Use the package ecosystem's semantic `@` manifest dialect. Machine-readable plugin dependencies express ranges such as `^1.2.3` or `>=1.2 &lt;2`; human display remains `pack@1.2.3`. Avoid unbounded stars, and verify compatibility and artifact digests at install and load time.

Capability grants declare record fields, incidents, external actions, storage and network destinations separately. Install-time permission review and runtime enforcement are both mandatory.

## Implementation order

1. Define versioned protocol envelopes, origin checks, request IDs and safe serializable value schemas.
2. Build the sandbox and verify denied DOM, origin, network and cross-tenant access.
3. Add read-only record access with explicit field grants and subscription teardown.
4. Add mediated mutations with expected versions and audit provenance.
5. Add server worker quotas, timeouts, restart policy and least-privilege scoped tokens.
6. Add a plugin scaffold/development tooling only after the actual host protocol works.
7. Build registry/distribution features last, with signing and revocation policy.

Cross-agency exchange, recursive shared read/write and Work OS-style metadata hooks remain future design concerns. Do not imply their existence through a generic catch-all API token.
