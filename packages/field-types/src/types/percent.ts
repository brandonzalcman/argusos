import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core percentage field with explicit fraction or whole-number storage semantics. */
export const percentFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "percent",
  displayName: "Percent",
  description: "Fixed-scale percentage with unambiguous canonical storage.",
  release: "core",
  postgresType: "numeric",
  filterOperators: [
    "equals",
    "not-equals",
    "greater-than",
    "greater-than-or-equal",
    "less-than",
    "less-than-or-equal",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
