import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later concurrency-safe auto-number field with tenant or incident sequence scope. */
export const autoNumberFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "auto-number",
  displayName: "Auto-number",
  description: "Server-assigned formatted sequence number scoped to a tenant or incident.",
  release: "later",
  postgresType: "text",
  filterOperators: [
    "equals",
    "not-equals",
    "contains",
    "starts-with",
    "greater-than",
    "less-than",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: false, deterministic: false },
  location: null,
});
