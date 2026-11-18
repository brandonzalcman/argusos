import { describe, it } from "vitest";

describe("workflow and alert jobs", () => {
  it.todo("resumes durable workflow runs and steps after worker crashes without duplicate effects");
  it.todo(
    "applies bounded exponential retries and dead-letters permanent step failures with redacted logs",
  );
  it.todo("prevents stale approval expiry from overriding an authenticated human decision");
  it.todo(
    "deduplicates provider delivery across Graphile retries using stable delivery idempotency",
  );
  it.todo("escalates only while acknowledgement is outstanding and preserves recipient scope");
  it.todo("verifies acknowledgement evidence and idempotently cancels pending escalation effects");
  it.todo(
    "records run, step, delivery, acknowledgement, approval, and escalation audit attribution",
  );
  it.todo("revalidates tenant, incident, actor, RLS, and FLS scope for every job transaction");
});
