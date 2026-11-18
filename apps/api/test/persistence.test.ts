import { describe, it } from "vitest";

describe("system catalog persistence", () => {
  it.todo("enforces RLS for two tenants even when an API service omits a tenant predicate");
  it.todo("enforces incident scope and explicit global-table policy at the database boundary");
  it.todo("applies field-level read/write policy to sensitive values and generated REST responses");
  it.todo("writes append-only field diffs with actor, position, incident, and request attribution");
  it.todo("rejects stale optimistic versions without losing either writer's field-level changes");
  it.todo("uses only DDL-engine plans for physical user-table migration and parameterized values");
});
