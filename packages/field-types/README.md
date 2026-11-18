# @argus/field-types

One declarative module for every field type in product plan section 5.3. `FieldTypePlugin` defines PostgreSQL planning, Zod validation, framework-neutral grid/form slots, filters, import/export and formula/location metadata. It deliberately has no React dependency. All behavioral methods currently throw `TODO(implementation)` errors.

## Implementation order

1. Implement registry uniqueness and lookup conformance tests before any plugin behavior.
2. Implement the twelve `release: "core"` modules in plan order: text, long text, number, currency, percent, date, date-time, duration, boolean, single select, multi select and user. For each, add validator/import/export tests before connecting DDL or UI hosts.
3. Connect structured `PostgresColumnPlan` values to `@argus/ddl-engine`; do not generate SQL in this package.
4. Resolve framework-neutral component slots in `@argus/ui` or the web/mobile host. Keep permission-filtered values and optimistic record versions in slot props.
5. Implement later modules in vertical slices: position/relation/attachment, contact/URL/status, formula/rollup/lookup/auto-number/signature/JSON, then PostGIS location with map support.
6. Add plugin-provided field types through the sandbox only after core registry and capability enforcement are stable.

`@argus/schema` owns the persisted field-definition union. This package owns behavior ports and metadata only.
