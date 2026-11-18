import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core short-text field. Validation, storage planning, rendering and conversion remain explicit stubs. */
export const textFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "text",
  displayName: "Text",
  description: "Short plain-text value with optional length constraints.",
  release: "core",
  postgresType: "text",
  filterOperators: [
    "equals",
    "not-equals",
    "contains",
    "not-contains",
    "starts-with",
    "ends-with",
    "in",
    "not-in",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
