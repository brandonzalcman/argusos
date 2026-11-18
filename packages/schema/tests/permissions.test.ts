import { describe, it } from "vitest";

describe("permission-sensitive definitions", () => {
  it.todo("rejects field definitions whose position overrides reference another tenant");
  it.todo("requires hidden fields to be removed from API results and realtime payloads");
  it.todo("treats empty position grants as deny-by-default at both API and PostgreSQL RLS layers");
  it.todo("prevents view and board grants from widening table or incident permissions");
  it.todo("keeps exercise and live incident subscriptions isolated for the same position");
  it.todo("redacts audit diffs for fields the audit reader cannot access");
  it.todo(
    "requires server-derived tenant, user, position, incident and request context for mutations",
  );
});
