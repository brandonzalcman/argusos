---
title: Field-type implementation guide
---

:::warning Scaffold guide
Field-type runtime modules and their Postgres behavior are not implemented in the owning packages. This guide defines order and safety requirements only.
:::

## One module per type

A field-type module in `packages/field-types/` declares its Postgres column mapping, shared Zod validators, grid/form rendering contracts, filter operators, import parser and export formatter. UI code must not define SQL or trust browser-provided metadata.

Initial slices should favor text, number, boolean, date/date-time and single-select before relation, formula, rollup, location, signature and attachment behavior. Each type needs explicit null/empty semantics, time zones, localization, accessibility and export behavior.

## Safe SQL contract

`packages/ddl-engine/` owns physical migration planning; `packages/expr/` owns CEL parsing/evaluation/SQL compilation. Field metadata is not arbitrary SQL. Identifiers are server-generated/managed and safely quoted, and values are always bound parameters.

Type conversions require a preview of failed conversions, a transactional migration plan and explicit handling of locks on large live tables. Destructive operations use retention-aware soft behavior rather than immediate irreversible drops.

## Security and audit

Sensitive field options are authorization inputs, not decoration. Ensure hidden values do not leak via validation errors, filter suggestions, aggregations, import dry runs, exports or map tiles. Record changes include field-level audit diffs but avoid uncontrolled secret duplication in logs.

## Implementation order for one field type

1. Add shared safe input/output schemas and inferred types.
2. Implement canonical value parsing, normalization and error contracts.
3. Add migration/DDL support with parameter/identifier safety tests.
4. Implement filter/validation semantics and database integration tests.
5. Add web/mobile input and read-only display with accessibility tests.
6. Add import/export and field-level permission tests.
7. Only then enable the type for board publishing and packs.
