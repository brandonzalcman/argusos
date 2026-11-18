import { describe, it } from "vitest";

describe("authenticated WebSocket protocol", () => {
  it.todo("authenticates upgrades before accepting application frames and never logs credentials");
  it.todo("rejects malformed, oversized, unsupported-version, and rate-limited messages");
  it.todo("derives tenant scope from verified auth rather than subscription payload claims");
  it.todo("reauthorizes incident subscriptions and alert replay after membership revocation");
  it.todo("closes expired sessions and releases subscriptions, presence, and locks exactly once");
  it.todo("rejects wildcard NATS subjects and cross-tenant/cross-incident subject confusion");
});
