import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later URL field with explicit protocol policy; fetch and link safety belong to adapters. */
export const urlFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "url",
  displayName: "URL",
  description: "HTTP or HTTPS URL constrained by the field definition.",
  release: "later",
  postgresType: "text",
  filterOperators: ["equals", "not-equals", "contains", "starts-with", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
