import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core multiple-choice field storing distinct opaque option IDs with deterministic ordering. */
export const multiSelectFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "multi-select",
  displayName: "Multi select",
  description: "A bounded set of options from an ordered, versioned option set.",
  release: "core",
  postgresType: "uuid",
  filterOperators: ["contains", "not-contains", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
