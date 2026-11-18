import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core arbitrary-precision number field; JavaScript number conversion rules remain unimplemented. */
export const numberFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "number",
  displayName: "Number",
  description: "Numeric value with optional precision, scale and bounds.",
  release: "core",
  postgresType: "numeric",
  filterOperators: [
    "equals",
    "not-equals",
    "greater-than",
    "greater-than-or-equal",
    "less-than",
    "less-than-or-equal",
    "in",
    "not-in",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
