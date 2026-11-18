import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core tri-state boolean field: true, false or null unless required by its field definition. */
export const booleanFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "boolean",
  displayName: "Boolean",
  description: "Boolean value with accessible true and false labels.",
  release: "core",
  postgresType: "boolean",
  filterOperators: ["equals", "not-equals", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
