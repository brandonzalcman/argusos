import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core calendar date without a time zone or time-of-day component. */
export const dateFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "date",
  displayName: "Date",
  description: "ISO calendar date with optional inclusive bounds.",
  release: "core",
  postgresType: "date",
  filterOperators: [
    "equals",
    "not-equals",
    "before",
    "after",
    "in",
    "not-in",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
