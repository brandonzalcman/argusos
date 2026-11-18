import { describe, it } from "vitest";

describe("audit retention jobs", () => {
  it.todo("never removes non-expired, active, or legal-hold audit partitions");
  it.todo("supports dry-run signed retention reports before any archival or detachment");
  it.todo("retries retention safely without partial deletion or cross-tenant partition selection");
  it.todo("writes an immutable system audit event for every retention decision");
});
