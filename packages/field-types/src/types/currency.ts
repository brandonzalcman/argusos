import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Core currency amount with ISO currency code; exchange-rate behavior is intentionally out of scope. */
export const currencyFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "currency",
  displayName: "Currency",
  description: "Fixed-scale monetary amount in one explicitly configured currency.",
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
