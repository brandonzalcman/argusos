import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core elapsed duration; calendar-aware month/year arithmetic is deliberately excluded. */
export const durationFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "duration",
  displayName: "Duration",
  description: "Elapsed interval with canonical storage and configurable display units.",
  release: "core",
  postgresType: "interval",
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
