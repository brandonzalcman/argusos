---
title: Workflow implementation guide
---

:::warning No workflow engine is running
Graphile Worker jobs, triggers, approvals and retries are planned behavior and require durable integration tests.
:::

## Versioned definition

Workflow JSON in `packages/schema/` references published table, field, alert and plugin versions. Validate dependency ranges and CEL before publish. Existing runs retain their originating workflow version so later edits do not reinterpret in-flight approvals or escalation decisions.

The React Flow editor belongs in `apps/web/`. Durable execution entry points belong in `apps/worker/`; schema packages contain no worker/infrastructure imports.

## Execution model

1. Accept a committed record/domain trigger with tenant and incident scope.
2. Deduplicate by stable event/run idempotency identity.
3. Persist a run and step log before side effects.
4. Evaluate conditions with explicit authorized context and bounded resources.
5. Execute one retryable step at a time with a durable checkpoint.
6. External actions use idempotency keys and scoped credentials.
7. Human approvals preserve actor/position, deadline and audit evidence.
8. Retry only classified transient failures; surface permanent failures without replay storms.

## Security constraints

A workflow is code-like automation and requires administrative publish authorization. A trigger cannot grant broader record or alert access than the workflow's declared execution identity allows. Every record mutation and external call inherits tenant/incident scope and auditable provenance.

Webhook responses contain no secrets in step logs. Test-run sample data is labeled and cannot execute production side effects. Exercise workflows remain isolated from live channels unless an explicit, audited policy says otherwise.

## Vertical slices

Start with a record-created trigger, condition and update-record step. Add durable retry/run-log tests, then assignments and delays, then alerts/approvals, and only later arbitrary plugin actions. Do not begin with a large node catalog that has no reliable execution semantics.
