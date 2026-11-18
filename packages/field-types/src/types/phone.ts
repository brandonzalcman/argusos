import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later phone field; canonicalization and region validation remain unimplemented. */
export const phoneFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "phone",
  displayName: "Phone",
  description: "Telephone number with an optional default region for import and display.",
  release: "later",
  postgresType: "text",
  filterOperators: [
    "equals",
    "not-equals",
    "contains",
    "starts-with",
    "in",
    "not-in",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
