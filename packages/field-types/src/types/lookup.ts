import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later related-field projection. Lookup reads must not bypass target table or target field permissions. */
export const lookupFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "lookup",
  displayName: "Lookup",
  description: "Read-only projection of a field from a permission-filtered related record.",
  release: "later",
  postgresType: "jsonb",
  filterOperators: ["equals", "not-equals", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: false, deterministic: false },
  location: null,
});
