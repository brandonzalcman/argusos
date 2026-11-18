# @argus/expr

Public contracts for ArgusOS's shared Common Expression Language (CEL) surface: visibility, validation, defaults, formulas, and workflow conditions. This package currently contains **no parser, evaluator, or SQL compiler implementation**.

## Boundaries

- Parse into a host-independent AST with source spans and strict byte/node/depth limits.
- Type-check against immutable, allow-listed bindings and function signatures. Each product surface has its own policy and expected result type.
- Evaluate with fixed time and hard step, deadline, collection, string, and byte budgets. There is no ambient clock, dynamic code, host callback, network, filesystem, or environment access.
- Validate tenant and incident provenance for every runtime binding. Workflow and record expressions must fail closed on isolation errors.
- Compile only a declared subset to PostgreSQL. Identifiers come from catalog mappings and are quoted; every value is an out-of-band `$n` parameter. Compilation never executes SQL and never replaces RLS.
- Return capability reports and structured unsupported-expression issues before publication, especially for nondeterministic generated-column formulas.
- Local ids are narrow integration ports until `@argus/schema` exports canonical identifiers. Physical table/column mappings integrate with `@argus/ddl-engine` through adapters rather than a package dependency.

## Public modules

- `ast`: CEL source, types, AST nodes, spans, and parse diagnostics.
- `context`: typed values, binding provenance, security context, function signatures, and sandbox limits.
- `parser` / `evaluator`: parse, type-check, and sandboxed evaluation stubs.
- `use-cases`: visibility, validation, default, formula, and workflow-condition wrappers.
- `capabilities`: per-target support analysis and unsupported-expression reporting.
- `sql`: parameterized SQL compiler, formula targets, and output safety inspection stubs.

## Implementation order

1. Align schema adapters and CEL conformance fixtures; implement bounded parsing and precise diagnostics.
2. Implement type checking, per-use policies, function signatures, and capability analysis with clear unsupported-expression errors.
3. Implement sandbox evaluation, resource accounting, fixed-time builtins, and tenant/incident provenance validation.
4. Add fail-closed visibility, validation, default, formula, and workflow wrappers with field-type/schema integration.
5. Implement the SQL subset with catalog-only identifier mappings, positional parameters, and PostgreSQL differential/security tests.
6. Integrate generated-column/view formulas with DDL preflight and transactional publish; integrate workflow conditions with durable audit runs.

Tests are intentionally todo-only. No expression source is executed and no database or external service is connected by this scaffold.
