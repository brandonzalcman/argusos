---

name: argus-field-type
description: Checklist and file layout for adding or implementing an ArgusOS field type (text, number, status, location, relation, formula...) in packages/field-types. Load for any field-type work.
---

# Field types

Each field type is one folder in `packages/field-types/src/<type>/` implementing `FieldTypeModule` from `@argus/schema`.

## Files

| File             | Exports                        | Job                                                                               |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `definition.ts`  | `<type>Field: FieldTypeModule` | Ties the pieces together; id, label, icon, options schema                         |
| `column.ts`      | `toColumn(options)`            | Postgres column type + constraints (e.g. `geometry(Point,4326)`, `numeric(18,4)`) |
| `validate.ts`    | `schema(options)`              | Zod schema for a value; used by API, forms, imports                               |
| `cell.tsx`       | `Cell`                         | Read-only grid cell renderer                                                      |
| `input.tsx`      | `Input`                        | Form input with label, error, disabled/read-only states                           |
| `filter.ts`      | `operators`                    | Filter operators + SQL builder (parameterised only)                               |
| `io.ts`          | `parse`, `format`              | CSV/XLSX import parsing and export formatting                                     |
| `<type>.test.ts` | —                              | Tests for validate, filter SQL, parse/format round-trip                           |

Register the module in `packages/field-types/src/registry.ts`.

## Rules

- Values are validated with the Zod schema at every boundary (API, import, workflow action).
- Filter SQL is always parameterised. Never interpolate values.
- Options changes that alter the column (e.g. precision) must produce a DDL step via `@argus/ddl-engine`, not a direct ALTER.
- Cell and Input read permissions (`hidden`, `readOnly`) from props; never fetch them.
- Location types use SRID 4326 and GeoJSON in the API.
- Formula/rollup/lookup are computed: no input component; `toColumn` returns a virtual generated column or a view column.

## Done when

`pnpm --filter @argus/field-types typecheck` and `test` pass, and the type appears in `registry.ts`.
