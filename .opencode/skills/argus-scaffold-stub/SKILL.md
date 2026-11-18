---

name: argus-scaffold-stub
description: Exact format for ArgusOS scaffold stubs — TODO(implementation) doc blocks, throwing bodies, component placeholders, todo tests and package boilerplate. Load before creating any stubbed file or new package.
---

# Writing scaffold stubs

A stub is a file another model will fill in later without seeing the plan. The doc block **is** the spec. Follow the stub convention in `AGENTS.md` exactly.

## Function stub

```ts
import type { TableDefinition, MigrationPlan } from "@argus/schema";

/**
 * TODO(implementation): Diff a draft table definition against the live one and return the ordered DDL steps to apply it.
 * Input: live — published definition or null for a new table; draft — edited definition from the Table Designer.
 * Output: MigrationPlan — ordered steps, each with parameterised SQL, a plain-English summary, a `destructive` flag, and failing-row counts for type conversions.
 * Errors: DdlConflictError when a field id is reused with an incompatible type.
 * Depends on: @argus/schema (TableDefinition, MigrationPlan), quoteIdent.
 * Security: caller must hold `table:design` on the tenant; no value interpolation into SQL.
 * Audit/scoping: none (pure planning).
 * Real time: none.
 */
export function planMigration(live: TableDefinition | null, draft: TableDefinition): MigrationPlan {
  throw new Error("TODO(implementation): planMigration");
}
```

Always include Input, Output, Errors, Depends on. Add Security, Audit/scoping and Real time lines whenever the code touches data, permissions or live screens; write "none" rather than leaving them out.

Use `TODO(decision): …` for an unresolved product choice and `TODO(verify): …` for an assumption that needs checking (e.g. an ElectricSQL API detail).

## React component stub

Components may render an accessible, clearly labelled placeholder. Never fake operational data.

```tsx
/**
 * TODO(implementation): Live grid for one user table, rendered with Glide Data Grid from an ElectricSQL live query; optimistic inline edits with per-field conflict banner.
 * Input: TableGridProps (tableId, viewId, position permissions).
 * Output: grid UI.
 * Errors: shows error state with retry on sync failure.
 * Depends on: @argus/ui, @argus/sdk useLiveQuery, @argus/field-types registry.
 * Security: hidden/read-only fields from the viewer's position.
 * Real time: yes — rows flash on change; new rows behind "N new" pill.
 */
export function TableGrid(props: TableGridProps): JSX.Element {
  return <ScaffoldPlaceholder label="Table grid" todo="TableGrid" />;
}
```
`ScaffoldPlaceholder` lives in `@argus/ui` and shows the component name and "Not implemented yet".

## Test stubs

```ts
describe("planMigration", () => {
  it.todo("adds a column for a new field");
  it.todo("reports failing rows for an incompatible type change");
  it.todo("soft-deletes removed fields as _deleted_<field>");
  it.todo("rejects reuse of a field id with an incompatible type");
});
```
No meaningless passing assertions.

## Package boilerplate (write in full, not stubbed)

- `package.json`: `"name": "@argus/<name>"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, scripts `build`, `typecheck`, `test`, `lint`; internal deps `workspace:*`, external deps `catalog:`.
- `tsconfig.json` extending the shared base config.
- `src/index.ts`: named re-exports of the public API only.
- `README.md`: 3–5 lines on what the package does and its public API.

## Don'ts

- No partial implementations "to get started".
- No `any`. No types that belong in `@argus/schema` defined locally.
- No license file.
