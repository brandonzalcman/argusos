import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later relation aggregate served through the table view; query generation remains unimplemented. */
export const rollupFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "rollup",
  displayName: "Rollup",
  description: "Read-only aggregate over permission-filtered related records.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: [
    "equals",
    "not-equals",
    "greater-than",
    "greater-than-or-equal",
    "less-than",
    "less-than-or-equal",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: false, deterministic: false },
  location: null,
});
