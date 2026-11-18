import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core instant stored with time zone; display-zone conversion belongs to the future form/grid adapters. */
export const dateTimeFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "date-time",
  displayName: "Date-time",
  description: "RFC 3339 instant with explicit offset and optional display time zone.",
  release: "core",
  postgresType: "timestamp-with-time-zone",
  filterOperators: ["equals", "not-equals", "before", "after", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
