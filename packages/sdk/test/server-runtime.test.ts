import { describe, it } from "vitest";

describe("scoped server plugin runtime", () => {
  it.todo("grants only administrator-approved capabilities and declared egress origins");
  it.todo("provides no ambient host filesystem, process, network, database, or secret access");
  it.todo("enforces memory, CPU, event duration, concurrency, payload, and egress limits");
  it.todo("revokes scoped tokens and subscriptions immediately when installation access changes");
  it.todo(
    "prevents stale lifecycle activation after revocation and tears down resources exactly once",
  );
  it.todo(
    "applies host RLS/FLS, incident isolation, dedupe, and immutable audit to plugin API calls",
  );
  it.todo(
    "redacts plugin logs and prevents user-controlled log forging or sensitive record disclosure",
  );
});
