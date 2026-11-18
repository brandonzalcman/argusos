import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core single-choice field storing an opaque option ID rather than a display label. */
export const singleSelectFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "single-select",
  displayName: "Single select",
  description: "One option from an ordered, versioned option set.",
  release: "core",
  postgresType: "uuid",
  filterOperators: ["equals", "not-equals", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
