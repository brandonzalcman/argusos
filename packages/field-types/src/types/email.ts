import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later email field. Delivery and verification are channel concerns, not field validation side effects. */
export const emailFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "email",
  displayName: "Email",
  description: "Email address with optional tenant-approved domain restrictions.",
  release: "later",
  postgresType: "text",
  filterOperators: [
    "equals",
    "not-equals",
    "contains",
    "ends-with",
    "in",
    "not-in",
    "is-empty",
    "is-not-empty",
  ],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: null,
});
