import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later tenant-position reference used for assignment and escalation; authorization behavior is a future slice. */
export const positionFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "position",
  displayName: "Position",
  description: "Reference to an operational position in the same tenant.",
  release: "later",
  postgresType: "uuid",
  filterOperators: ["equals", "not-equals", "in", "not-in", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
