import { describe, it } from "vitest";

describe("SQL identifier and value safety", () => {
  it.todo("quotes embedded double quotes and rejects NUL, control characters, and qualified paths");
  it.todo("derives only stable t_<short_id> and v_<short_id> names from validated short ids");
  it.todo("never interpolates strings containing quotes, comment markers, or DROP statements");
  it.todo("binds JSON, arrays, binary values, timestamps, and null through explicit parameters");
  it.todo(
    "rejects placeholder gaps, unused parameters, multiple statements, and data-modifying CTEs",
  );
});

describe("diffing and destructive migrations", () => {
  it.todo("produces deterministic diffs and leaves physical names unchanged after display renames");
  it.todo(
    "requires read-only conversion preflight and blocks publication on unacknowledged failures",
  );
  it.todo("renames removed fields to unique _deleted_ tombstones instead of dropping them");
  it.todo("retains removed tables and their audit history until the approved retention deadline");
  it.todo("binds destructive approval to the exact plan digest and every destructive operation");
  it.todo("rejects retention purges before expiry or without a separately authorized audit event");
  it.todo("blocks lock-heavy changes during active incidents according to explicit lock policy");
});

describe("transaction atomicity and publication", () => {
  it.todo(
    "rolls back DDL, backfills, catalog writes, RLS changes, and audit writes on any failure",
  );
  it.todo("does not expose a new live version before the migration transaction commits");
  it.todo("rejects stale live versions and stale draft revisions with optimistic conflicts");
  it.todo("rejects expired or modified plans by checking their digest before the first statement");
  it.todo(
    "publishes and audits in the same transaction with actor, position, request, and incident ids",
  );
  it.todo("rollback creates a new live version without deleting or rewriting prior history");
  it.todo(
    "rollback fails safely when required retained columns or target versions are unavailable",
  );
});

describe("tenant, incident, RLS, and audit isolation", () => {
  it.todo("rejects snapshots, plans, preflights, and execution contexts from different tenants");
  it.todo(
    "requires incident RLS bindings for incident-scoped tables and probes cross-incident denial",
  );
  it.todo("keeps global tables tenant-isolated without inventing an incident predicate");
  it.todo("rejects execution roles with BYPASSRLS and verifies policies after every publication");
  it.todo("redacts sensitive values from conversion samples, previews, errors, and audit payloads");
  it.todo("prevents one tenant from loading, publishing, or rolling back another tenant's version");
});
