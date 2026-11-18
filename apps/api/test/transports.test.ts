import { describe, it } from "vitest";

describe("tRPC and versioned REST transports", () => {
  it.todo("uses the same domain authorization for equivalent tRPC and REST operations");
  it.todo("generates valid OpenAPI 3.1 with unique operation IDs and scoped security requirements");
  it.todo("rejects unscoped API keys from tenant, incident, field, and administration operations");
  it.todo("returns stable redacted problem responses without leaking inaccessible row existence");
  it.todo("keeps public submissions in review until an authorized incident reviewer approves them");
  it.todo("quarantines uploads and returns only short-lived scoped upload grants");
  it.todo(
    "exposes liveness and readiness without secrets, internal URLs, or operational record data",
  );
});
