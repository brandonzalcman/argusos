import { describe, it } from "vitest";

// Required fixtures: two tenants, each with live and exercise incidents, two
// positions, sensitive fields, global records, and an append-only audit trail.
// Connections must SET LOCAL claims inside transactions; NEVER test RLS with a
// table owner, superuser, or BYPASSRLS role and call that an authorization pass.
describe("database tenant and incident isolation", () => {
  it.todo(
    "enables and FORCEs RLS on every tenant-scoped user table, including new DDL-engine tables",
  );
  it.todo(
    "rejects direct SELECT, INSERT, UPDATE, and DELETE across tenants for the NOBYPASSRLS runtime role",
  );
  it.todo("allows only the active incident while preserving explicitly authorized global records");
  it.todo(
    "separates exercise records from operational incidents in reads, writes, search, relations, and reporting views",
  );
  it.todo(
    "enforces position and ABAC policy changes in the same transaction as the data operation",
  );
  it.todo(
    "denies rows when tenant, user, position, or incident claims are absent, null, malformed, or stale",
  );
  it.todo(
    "prevents tenant identifiers and incident identifiers in requests from overriding trusted session claims",
  );
  it.todo("enforces field-level privileges for sensitive personal and intelligence columns");
  it.todo("applies equivalent predicates to Electric publications and Martin tile functions");
});

describe("write integrity and audit", () => {
  it.todo(
    "rejects stale optimistic versions without changing the row or emitting a realtime event",
  );
  it.todo(
    "records actor, position, tenant, incident, request ID, version, and field-level diff for every mutation",
  );
  it.todo("prevents runtime roles from updating or deleting append-only audit records");
  it.todo("rolls back data, audit, and outbox state together when a transaction fails");
});
