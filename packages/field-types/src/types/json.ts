import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later JSON field with an optional JSON Schema document; no arbitrary code or SQL expressions are accepted. */
export const jsonFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "json",
  displayName: "JSON",
  description: "Structured JSON value with optional schema constraints.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: ["equals", "not-equals", "contains", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
