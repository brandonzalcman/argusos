import { describe, it } from "vitest";

describe("parameterized SQL and injection prevention", () => {
  it.todo("binds quotes, comment markers, semicolons, and DROP text as values rather than SQL");
  it.todo("quotes catalog identifiers and rejects arbitrary CEL text as table or column names");
  it.todo("keeps parameter indexes contiguous and rejects unused, missing, or excess values");
  it.todo(
    "rejects raw SQL functions, dynamic identifiers, multi-statements, and data-modifying CTEs",
  );
  it.todo("enforces the SQL parameter budget and returns explicit unsupported-expression issues");
  it.todo(
    "matches PostgreSQL and evaluator semantics for null, numeric, timestamp, and boolean expressions",
  );
  it.todo("never treats SQL output inspection as a substitute for database RLS");
});

describe("CEL parsing, typing, and capabilities", () => {
  it.todo("parses supported CEL with exact source spans and bounded UTF-8 source size");
  it.todo(
    "rejects unknown bindings, invalid members, wrong argument types, and non-boolean conditions",
  );
  it.todo(
    "returns per-target capability results with reason, node id, span, and remediation message",
  );
  it.todo("rejects now(), user, request, and incident bindings for generated-column formulas");
  it.todo("allows a formula in application evaluation when SQL compilation is unsupported");
  it.todo("enforces boolean results for visibility, validation, and workflow conditions");
  it.todo("enforces declared field types for default and formula results");
});

describe("sandbox limits and hostile expressions", () => {
  it.todo("rejects excessive AST depth and node counts before evaluation or compilation");
  it.todo("stops evaluation at step and monotonic deadline budgets without partial values");
  it.todo("bounds list, map, string, bytes, and comprehension allocations and iteration");
  it.todo(
    "offers no general loops, recursion, dynamic code, host callbacks, network, filesystem, or env access",
  );
  it.todo("uses one fixed trusted timestamp for now() within an evaluation");
  it.todo(
    "reports numeric overflow, division by zero, and missing keys without leaking record values",
  );
  it.todo("detects formula dependency cycles before evaluation or SQL publication");
});

describe("tenant and incident isolation", () => {
  it.todo("rejects record, user, position, and workflow bindings from another tenant");
  it.todo("rejects a record binding from another incident even when field names and types match");
  it.todo("requires an incident binding for incident-scoped evaluation and SQL compilation");
  it.todo(
    "does not add an incident requirement to global expressions while retaining tenant isolation",
  );
  it.todo("fails closed when visibility, validation, default, or workflow provenance is missing");
  it.todo(
    "carries tenant and incident scope into compiled SQL for RLS-protected integration queries",
  );
  it.todo("prevents workflow conditions from reading or triggering across incident boundaries");
});
