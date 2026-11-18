import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core rich/long-text field. Rich content sanitization belongs to its future validator and UI adapter. */
export const longTextFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "long-text",
  displayName: "Long text",
  description: "Multiline plain, Markdown or sanitized rich-text content.",
  release: "core",
  postgresType: "text",
  filterOperators: ["contains", "not-contains", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
