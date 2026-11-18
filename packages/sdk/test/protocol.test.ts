import { describe, it } from "vitest";

describe("sandboxed iframe protocol", () => {
  it.todo("negotiates one protocol version with a one-time nonce and matching manifest hash");
  it.todo("rejects wrong-origin, wrong-source, replayed, stale-session, and oversized messages");
  it.todo("never uses wildcard target origins or trusts tenant/actor claims from plugin messages");
  it.todo("correlates responses and rejects pending requests on navigation, logout, and disposal");
  it.todo("cleans up subscriptions across reconnect and prevents cross-installation message leaks");
  it.todo("enforces table, field, incident, action, and expiry dimensions of capability grants");
  it.todo(
    "uses expectedVersion for updates and records plugin plus user/position audit attribution",
  );
});
