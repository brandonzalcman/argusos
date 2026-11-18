import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later CEL formula field. Parsing, dependency analysis and SQL compilation are owned by @argus/expr. */
export const formulaFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "formula",
  displayName: "Formula",
  description: "Read-only derived value from a typed, sandboxed CEL expression.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: ["equals", "not-equals", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: false, deterministic: false },
  location: null,
});
