import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later ordered status field with colour and closed-state semantics for boards and workflows. */
export const statusFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "status",
  displayName: "Status",
  description: "Ordered option ID with colour, initial state and closed-state metadata.",
  release: "later",
  postgresType: "uuid",
  filterOperators: ["equals", "not-equals", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
